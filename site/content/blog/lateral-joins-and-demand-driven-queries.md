---
title: "Lateral Joins and Demand-Driven Queries"
category: "Deep-dive"
authors: "mcsherry"
date: "Tue, 18 Aug 2020 13:30:23 +0000"
description: ""
slug: "lateral-joins-and-demand-driven-queries"
---

In today's post we are going to show off Materialize's `LATERAL` join ([courtesy **@benesch**](https://github.com/MaterializeInc/materialize/pull/3713)), and how you can use it to implement some pretty neat query patterns in an incremental view maintenance engine! In particular, in the streaming SQL setting, lateral joins automatically turn your SQL prepared statement queries into what is essentially a streaming, consistent, microservice (minus the hard work). You just put your parameter bindings on a data bus, and the answer (and any changes) stream out the other side.

## What's a lateral join?

In SQL the `LATERAL` join modifier allows relations used in a join to "see" the bindings in relations earlier in the join. This allows us (you, especially) to write joins where the matched records can be restricted beyond the filters you might have in a `WHERE` clause. Let's take an example. For each state in our dataset, we want to pop out the top three cities by population. Let's start by making a table containing some information to work off of:

```sql
CREATE TABLE cities (
    name text NOT NULL,
    state text NOT NULL,
    pop int NOT NULL
);

INSERT INTO cities VALUES
    ('Los_Angeles', 'CA', 3979576),
    ('Phoenix', 'AZ', 1680992),
    ('Houston', 'TX', 2320268),
    ('San_Diego', 'CA', 1423851),
    ('San_Francisco', 'CA', 881549),
    ('New_York', 'NY', 8336817),
    ('Dallas', 'TX', 1343573),
    ('San_Antonio', 'TX', 1547253),
    ('San_Jose', 'CA', 1021795),
    ('Chicago', 'IL', 2695598),
    ('Austin', 'TX', 978908);

```

Now, how do we express "top three cities, by state"? It's a bit awkward to do in vanilla SQL. Many folks might use window functions, but it is actually pretty easy to do with a lateral join:

```sql
SELECT state, name FROM
    -- for each distinct state we know about ...
    (SELECT DISTINCT state FROM cities) states,
    -- ... extract the top 3 cities by population.
    LATERAL (
        SELECT name, pop
        FROM cities
        WHERE state = states.state
        ORDER BY pop
        DESC LIMIT 3
    )

```

If you run this in Materialize, against the table up above, you should see

```
state | name
------+-------------
TX    | Dallas
AZ    | Phoenix
IL    | Chicago
TX    | Houston
CA    | San_Jose
NY    | New_York
CA    | San_Diego
CA    | Los_Angeles
TX    | San_Antonio
(9 rows)

```

which is a bit of a mess because we didn't put an `ORDER BY` clause in there. Oops! If you tried to write this query without a lateral join you wouldn't be able to express `WHERE state = states.state` in the subquery, and if you expressed it outside the subquery the `LIMIT 3` would apply to all records rather than group-by-group. The above query is an idiomatic way to get the "top k" records in each group, which is useful when you want to go deeper than the maximum value. And indeed, when we look at the Materialize plan for the query, using Materialize's [`explain`](https://materialize.io/docs/sql/explain/) command, it is exactly that:

```
%0 =
| Get materialize.public.cities (u1)
| TopK group=(#1) order=(#2 desc) limit=3 offset=0
| Project (#1, #0)

```

It turns out we have a specific operator for `TopK` because it really is that useful. It's also crucial for correctness, here and in other settings like correlated subqueries.

## Lateral Joins in Materialize

Now, we haven't actually done anything **_new_** yet. Many databases support the `LATERAL` keyword, and while Materialize can **_maintain_** lateral joins, is that really something to get excited about? Check this out. Let's do the query up above, but a little different. Rather than seed the lateral join with **_all_** states, let's use a new input collection instead.

```sql
-- create a table to house states of interest.
CREATE TABLE queries (state text NOT NULL);

-- same query as above, but starting from `queries`.
-- also, we materialize a view to build a dataflow.
CREATE MATERIALIZED VIEW top_3s AS
SELECT state, name FROM
    -- for each distinct state we are asked about ...
    (SELECT DISTINCT state FROM queries) states,
    -- ... extract the top 3 cities by population.
    LATERAL (
        SELECT name, pop
        FROM cities
        WHERE state = states.state
        ORDER BY pop
        DESC LIMIT 3
    );

```

This query is pretty much the same, except that `queries` is initially empty. The lateral join will produce no results.

```sql
materialize=> SELECT * FROM top_3s;
state | name
------+------
(0 rows)

materialize=>

```

But if we **_add_** a state to `queries`,

```sql
-- add California to our queries.
materialize=> INSERT INTO queries VALUES ('CA');
INSERT 0 1
materialize=> SELECT * FROM top_3s;
state  | name
-------+-------------
CA     | San_Jose
CA     | San_Diego
CA     | Los_Angeles
(3 rows)

materialize=>

```

Now we are getting some results out! For as long as the input contains `'CA'` we will maintain the top three cities in California. And generally, we will maintain the top three cities for any state added to the input, but not for any others. Whoever controls the contents of `queries` determines how much work we have to do as the data change. This last part is subtle, and we'll go in to a bit more detail in a bit. The `top_3s` query does not compute the top three cities for each state and then hand out the results we ask for. It only does the work for the states we ask for. The states we don't ask about never reach the `TopK` operator. This is really important for queries like the above, because `TopK` is one of the relatively more expensive operators to maintain. You can use **_live data_** to enable or disable incremental view maintenance, at the granularity of **_records_**.

## But is it new?

This is pretty different from your standard RDBMS, in which queries happen once, and you don't get to tweak their inputs live as they run. The closest connection is probably to [prepared statements](https://en.wikipedia.org/wiki/Prepared_statement), which are ways to write queries with "holes" in them. The RDBMS can do some amount of work even without you having yet specified the full query, but that work is mostly restricted to optimization. In contrast, Materialize can get started on the query **_execution_** for these queries, building a dataflow that is ready to respond to a **_stream_** of parameter bindings for the statements. This is a high-throughput take on prepared statements, where many users can submit many concurrent parameter bindings, all on the data plane rather than control plane. Plus it ends up producing an output stream that not only reports answers but also monitors the changes to the query results for each parameter binding, until the binding is uninstalled. If your goal is to build an application that needs to respond to thousands of parameterized queries each second, lateral joins are a great way to automatically turn your SQL prepared statements into high-throughput, data-driven, maintained views.

---

Quick shout out to [Noria](https://github.com/mit-pdos/noria), a super-interesting research project at MIT. The project lets you write SQL, use prepared statements, and it will handle populating the dataflow with the records relevant to the queries. It has a bit of a different take on goals (a fast, eventually consistent, read cache), but its behavior is similar to using Materialize with lateral joins.

---

## In greater detail

Let's dive in to the inner workings of lateral joins, and check out their behavior on larger datasets. To start, let's check out the actual query plan for our query-driven lateral join. Materialize has this neat `EXPLAIN` command that helps out when you want to inspect the plan we've produced for your query.

```sql
materialize=> EXPLAIN PLAN FOR
SELECT state, name FROM
    -- for each distinct state we are asked about ...
    (SELECT DISTINCT state FROM queries) states,
    -- ... extract the top 3 cities by population.
    LATERAL (
        SELECT name, pop
        FROM cities
        WHERE state = states.state
        ORDER BY pop
        DESC LIMIT 3
    );

```

This ends up with the following plan:

```
%0 =
| Get materialize.public.queries (u8546)
| Distinct group=(#0)
| ArrangeBy (#0)

%1 =
| Get materialize.public.cities (u8544)

%2 =
| Join %0 %1 (= #0 #2)
| | implementation = Differential %1 %0.(#0)
| | demand = (#0, #1, #3)
| TopK group=(#0) order=(#3 desc) limit=3 offset=0
| Project (#0, #1)

```

Steps `%0` and `%1` are about naming and preparing the join inputs. The real work is in step `%2`, where we **_first_** join the `queries` and `cities` collections to extract the cities of interest, and **_then_** feed the results in to the `TopK` operator. It's worth stressing again that this query plan **_holds back_** the cities for states that aren't present in `queries`. The `TopK` operator, which actually expands out into a sequence of 16 differential dataflow `Reduce` operators, is spared all of that city data that isn't required. However, the unused city data are all poised and ready the moment new query records show up; a new record in `queries` would cause the join to produce the corresponding city records, and the `TopK` to update with the corresponding top cities for that state.

## A reactive microservice

Let's flesh this out a bit more. Instead of a collection `queries` of state names, let's imagine that you have distinct identifiers for each query, and the state name is just the associated data.

```sql
-- use an explicit identifier to distinguish queries.
CREATE TABLE queries (id int, state text NOT NULL);

```

Our query needs to tag query results with the query identifiers they correspond to. That's a minor rewrite, to

```sql
SELECT id, state, name FROM
    -- for each distinct state we are asked about ...
    queries,
    -- ... extract the top 3 cities by population.
    LATERAL (
        SELECT name, pop
        FROM cities
        WHERE state = queries.state
        ORDER BY pop
        DESC LIMIT 3
    );

```

Notice that we've scratched the `SELECT DISTINCT` subquery around `queries`, and we are also returning the `id` as the first result. The plan for this query is roughly the same as above, with a few important details to call out:

```
%0 =
| Get materialize.public.queries (u8548)
| ArrangeBy (#0)

%1 =
| Get materialize.public.queries (u8548)
| Distinct group=(#0)
| ArrangeBy (#0)

%2 =
| Get materialize.public.cities (u8544)

%3 =
| Join %1 %2 (= #0 #2)
| | implementation = Differential %2 %1.(#0)
| | demand = (#0, #1, #3)
| TopK group=(#0) order=(#3 desc) limit=3 offset=0

%4 =
| Join %0 %3 (= #0 #2)
| | implementation = Differential %3 %0.(#0)
| | demand = (#0, #1, #3)
| Project (#1, #0, #3)

```

Steps `%1`, `%2` and `%3` should look familiar; they are the same as in the plan just above. The new steps, `%0` and `%4` are pretty easy to explain: `%0` exists because we need one instance of `queries` that retains the `id` column, and `%4` exists to join `queries` against the results of the lateral join and recover the `id` to result association. In addition to doing more without being wildly complicated, this query plan shows off a really neat feature of lateral joins (and correlated subqueries). The subquery is computed only once for each **_distinct_** parameter binding. If 10 people want to start monitoring the top three cities in California, we'll determine those three cities only once, and then join on the query identifiers to the results. If 100,000 people want to track the top three posts of some common author, that result is determined and maintained just once. Because you wrote it as SQL, rather than by hand.

## Conclusions

Lateral joins on streaming SQL infrastructure like [Materialize](https://materialize.io) allow you to do some pretty amazing things. If you have SQL queries as prepared statements, you can automatically turn them in to lateral joins against parameter bindings that you pull off of Kafka. If you'd like to try this out, [go grab Materialize now](https://materialize.io/download/)!