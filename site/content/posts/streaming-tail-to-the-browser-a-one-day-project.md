---
title: "Streaming TAIL to the Browser - A One Day Project"
category: "Deep-dive"
authors: "chris"
date: "Fri, 24 Jul 2020 09:12:59 +0000"
description: ""
image: "img/streaming-tail-to-the-browser-a-one-day-project.jpg"
---

Last week concluded up my first week at Materialize, with Friday being my first Skunkworks Friday. Skunkworks Friday is a Materialize sponsored day of the week to spend on personal development and learning. Given that it was my first week, I challenged myself to build something using Materialize. Having spent most of my career working on asynchronous systems, I knew that streaming the results of a [TAIL](https://materialize.io/docs/sql/tail) operation to a web browser would be interesting, useful and possibly attainable. I figured one day would be enough for a proof of concept and that's about [where I ended up](https://github.com/cirego/skunkworks-20200717). It's far from pretty but it shows the concept and that's what I wanted!

## **What Did I End Up With?**

Below is an animation of my browser responding to real-time updates from two different views of Wikipedia edits, computed using the same input source. I even had time to put in a fancy and horribly incorrect (more on that later) visualization for the `top10` table: \[caption id="attachment\_1667" align="alignnone" width="750"\]![Animated image showing edit counts and top editors being updated dynamically in the browser](https://materialize.io/wp-content/uploads/2020/07/updating_counts_live-1.gif) It's alive! If a bit monstrous...\[/caption\]

## **The Initial Plan**

Now that you've seen the results, let's talk about my initial plan of action. In past work experiences, I've built real-time, streaming systems using [Postgres](https://www.postgresql.org/), [psycopg2](https://www.psycopg.org/), [Tornado WebServer](https://www.tornadoweb.org/en/stable/guide/intro.html), [Momoko](https://github.com/FSX/momoko) and [VegaLite](https://vega.github.io/vega-lite/). I opted to reuse these same tools to limit risk and focus on accomplishing my goal. Bolstered by the documentation for [Tailing Through a Driver](https://materialize.io/docs/sql/tail/#tailing-through-a-driver), I thought it would be pretty simple to do something like the following:
1. Start a `materialized` instance and create some interesting views.
2. Start a Tornado server to serve HTML and run queries against my local `materialized` instance.
3. Browse to main `index` page hosted by Tornado, which loads some Javascript to open a `websocket` back to Tornado.
4. The Tornado server responds with initial results of the query and then streams a changelog to the browser.
5. The browser updates the DOM as changes are received.
6. Time permitting, add a nice visualization using VegaLite.
I casually made my way through the [Getting Started Guide](https://materialize.io/docs/get-started/) before finishing my first cup of coffee. Step 2, however, required multiple cups of coffee.

## **A Blocking Issue**

When writing asynchronous systems, blocking calls are the enemy. In Tornado, a single blocking call stalls the event loop, causing head of line contention and reducing our concurrent web server to serving one request at a time. As such, we must take care to avoid any blocking calls from the main thread. Initially, I was unconcerned. The typical cure-all for dealing with blocking calls is to wrap the method in a `ThreadPoolExecutor` and `await` the results. Sadly, as I started to type up the solution, I realize that I failed to account for `psycopg2.copy_expert` being a blocking call that never returns. In hindsight, this is obvious: `TAIL` presents an interface to endlessly stream the inserts and deletes for a view. My next thought was to start a dedicated thread to create a shared file-like object and block indefinitely inside `psycopg2.copy_expert`. I figured it would be simple to spin-up a `coroutine` that implements non-blocking reads of this shared object. Instead of trying to remember how to write one from scratch, I spent my second cup of coffee reading the Momoko source code in the hopes of inspiration. However, the methods exposed from `psycopg2` via `momoko` are async friendly. When I finally read [Thinking pyscopg3](https://www.varrazzo.com/blog/2020/03/06/thinking-psycopg3/) and the linked [COPY\_EXPERT async](https://github.com/psycopg/psycopg2/issues/428) issue, I quickly came to realize that this was a bigger battle than I could fight in one day. In the interests of "just getting something working", I settled on a hack using two Python processes and a `POST` handler. The first process runs the blocking call to `tail`, printing the results to `stdout`. The second process reads from `stdin`, converting each message to JSON and then `POST`ing the result to Tornado. It's a hack but it works.

## **90% Done**

Once I had my `tail | post` hack in place, it was fairly straightforward to broadcast updates from `POST` to all `websocket` listeners. Unfortunately, while it was straightforward to have clients receive live updates, I was unable to fix the visualization buggy behavior. The obvious issue that the `top10` visualization doesn't actually have 10 rows. This is because newly connected clients do not actually receive an initially complete view but instead only see updates from after their first connection. This means that the visualization only contains a compacted view of the patch updates rather than a correct view. I plan on fixing this as part of my next Skunkworks Friday project. Before discussing future work / fixing the last 10%, let's first walk through how the implementation works.

## **How Does it Actually Work?**

In the background, we need to run the following services:
1. A `materialized` instance, creating the Wikipedia example views and streaming updates from Wikipedia directly into Materialize.
2. A local Tornado application.
3. Two scripts, one to `POST` changes from `counter` to Tornado and another to `POST` changes from `top10` to Tornado.
When a local client connects to Tornado, the following will happen:
1. The browser will fetch `index.html`, which contains Javascript to open two WebSocket connections, one to `api/v1/stream/counter` and another to `api/v1/stream/top10`.
2. When a new message arrives on the `counter` listener, Javascript will search for the `counter` element and replace the inner contents with the new value.
3. When a new message arrives on the `top10` listener, Javascript will update two local arrays, `insert_values` and `delete_values` with the new updates.
4. Every 1000 milliseconds, Javascript will generate a [Vega Changeset](https://vega.github.io/vega-lite/tutorials/streaming.html) using the `insert_values` and `delete_values` arrays to redraw **only** the elements that have changed.
And other than the glaring, obvious, no-good bug, it works! The source code for this project [is available here](https://github.com/cirego/skunkworks-20200717).

## **Future Work -- It's Not Perfect**

Clearly, if this was anything other than a proof of concept, I would have some work left ahead of me:
* **Bug**: fix the initial synchronization of state for visualizations.
* **Improvement**: Try using psycopg3\. There has been a lot of recent work on rewriting psycopg with `async`/`await` in mind and, as of July 1st, it even has [async copy support](https://twitter.com/psycopg/status/1278360204212449280)! This would eliminate the need for the `tail | post` processes by allowing Tornado to call `TAIL` directly.
* **Improvement**: add an `HTTP POST` [sink](https://materialize.io/docs/sql/create-sink/) to `materialized`. While using `psycopg3` eliminates the `tail | post` processes, these could also be eliminated by adding a `POST` sink that allows `materialized` to send updates directly to any web server.

## **Learnings and Conclusion** 
* It's been a long road for asynchronous Python and we are agonizingly close to having asynchronous web servers that can utilize event driven features in modern databases. Thankfully, it appears that the recent work on psycopg3 promises to address both `LISTEN/NOTIFY` use cases for Postgres and the `TAIL` use case for Materialize.
* Time bounding individual tasks may lead to sub-optimal solutions but it is essential for delivering something in a limited time window. Had I opted to write my own asynchronous handler for `psycopg2.copy_expert`, I likely would have ended the day without actually seeing the results of my work. By time-boxing my exploration, I maintained the time necessary to write the Tornado web handlers and Javascript code.
* Having dedicated, creative time at work is great for exploring new ideas and can really help people engage with the product. As a father of two under two, I no longer have time for coding outside of work hours. Skunkworks Friday gave me the opportunity to use our product in a fun and creative way.
It might be only me, but websites that update in real-time have a je ne sais quoi that provides a tangible user experience. Today, I described one of many methods for building a data processing pipeline and user experience that update in real-time, but using plain SQL for data transformations! If you like working on these types of experiences, join [our community Slack instance](https://join.slack.com/t/materializecommunity/shared_invite/zt-fpfvczj5-efOE_8qvM4fWpHSvMxpKbA) because I'd love to hear from you!