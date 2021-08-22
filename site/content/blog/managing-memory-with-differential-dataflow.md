---
title: "Managing memory with differential dataflow"
category: "Timely"
authors: "mcsherry"
date: "Tue, 05 May 2020 10:00:14 +0000"
description: ""
slug: "managing-memory-with-differential-dataflow"
---

## Self-compacting dataflows

Those of you familiar with dataflow processing are likely also familiar with the constant attendant anxiety: won't my constant stream of input data accumulate and eventually overwhelm my system? That's a great worry! In many cases tools like [differential dataflow](https://github.com/TimelyDataflow/differential-dataflow) work hard to maintain a compact representation for your data. At the same time, it is also reasonable that you might just point an unbounded amount of data at such a system, and then no amount of clever compaction is going to save you, probably. Let's take an example: you have a stream of `(key, val, time)` records flowing in, and you'd like to retain the most recent `val` for each `key`, where "recent" is determined by `time`. There is no a priori bound on the number of updates you might see, but let's imagine that there are only so many distinct `key`s you might see, and so it is reasonable to want this maintained and readily available by random access. As if you had used a hash map, or something similar. We [recently discussed this problem](https://github.com/frankmcsherry/blog/blob/master/posts/2020-03-26.md) and ended up writing a custom differential dataflow operator. That was a bit of work, and probably not the most maintainable code. It is certainly not a great solution if you would like to change the logic a little bit, perhaps maintaining the three most recent values, for example. What if we could do all of this logic _**using existing dataflow operators**_, rather than writing new ones from scratch? That's what we'll get up to today.

### An unboundedly growing baseline

Let's start with a simple differential dataflow program that does what we want, but whose memory may grow unboundedly as our input evolves. We'll start with the dataflow fragment, which is just going to mirror the logic up above: maintain the most recent values for each key. I'm actually just going to conflate the time and value, and have it report the most recent time (clearly we could stick some value in there too, but let's not gunk up the example with that).

```rust
// Create input and probe handles to use throughput the program.
let mut input = differential_dataflow::input::InputSession::new();
let mut probe = timely::dataflow::ProbeHandle::new();

// Build a dataflow to present most recent values for keys.
worker.dataflow(|scope| {

use differential_dataflow::operators::reduce::Reduce;

// Determine the most recent inputs for each key.
input
.to_collection(scope);
.reduce(|_key, input, output| {
// Emit the last value with a count of 1
let max = input.last().unwrap();
output.push((*max.0, 1));
})
.probe_with(&mut probe);
});

```

For those of you not familiar with differential dataflow, the computation takes the stream `input` and re-interprets it as ongoing changes to an accumulated collection. Records in that collection should have a `(key, val)` structure, as the `reduce` method is applied to them and retains for each `key` the largest `val` (they are sorted in its `input`, and let's imagine the value starts with the timestamp). This dataflow doesn't do anything with its output, but we'll be able to monitor `probe` to determine how long it takes to determine that output. This should give us a sense for if and to what degree it struggles. I also wrote the following fairly simple open-loop harness that is meant to show us slowing down, if we do so. It takes as input (from the command line) a number of nanoseconds to wait between each input record, and as often as it can it introduces as many records as it is permitted to do.

```rust
// Number of nanoseconds between each record.
let pause_ns: u64 = std::env::args()
.nth(1)
.expect("Must supply an inter-record pause")
.parse()
.expect("Pause must be an integer");
let pause = Duration::from_nanos(pause_ns);
// `u32` because `Duration` cannot be multiplied by anything larger.
let mut req_counter = worker.index() as u32;
// We track the maximum latency from insert to acknowledge.
let mut max_latency = Duration::default();

loop {
// Refresh our view of elapsed time.
let elapsed = worker.timer().elapsed();

// Refresh the maximum gap between elapsed and completed times.
// Important: this varies based on rate; low rate ups the latency.
let completed = probe.with_frontier(|frontier| frontier[0]);
if max_latency &lt; elapsed - completed {
max_latency = elapsed - completed;
}

// Report how large a gap we just experienced.
if input.time().as_secs() != elapsed.as_secs() {
println!("{:?}\tmax latency: {:?}", elapsed, max_latency);
}

// Insert any newly released requests.
while pause * req_counter &lt; elapsed {
input.advance_to(pause * req_counter);
input.insert((0, pause * req_counter));
req_counter += worker.peers() as u32;
}
input.advance_to(elapsed);
input.flush();

// Take just one step! (perhaps we should take more)
worker.step();
}

```

This computation produces outputs that demonstrate progressive degeneration in the maximum latency:

```
mcsherry@Echidnatron compaction % cargo run -- 1000000
Finished dev [unoptimized + debuginfo] target(s) in 0.05s
Running `target/debug/compaction 1000000`
1.149792711s max latency: 259.792711ms
2.210526377s max latency: 729.526377ms
3.122910684s max latency: 1.277910684s
4.658850898s max latency: 2.029850898s
6.011779888s max latency: 2.888779888s
8.365166689s max latency: 4.596166689s
13.102234643s max latency: 8.443234643s
23.28861244s max latency: 17.27661244s
55.348870119s max latency: 46.982870119s
^C
mcsherry@Echidnatron compaction %

```

You can see here that almost immediately our `max latency` metric is a second behind, despite printing reports each second. Pretty soon we are what I judge to be hopelessly behind. This makes sense, because we are just adding more and more data to our input. Each record we add prompts a re-computation of the maximum, and with 1,000 of these each second we quickly have thousands of records, corresponding to millions of records to re-consider each second. Now, _**we**_ know that we only have to track the most recent report, but differential dataflow is carefully prepared for you to make any modification to the input at all, including the deletion of all but one record (for each of the input records). The above is a debug build, but the same thing happens if we use a release build and increase the offered load (decreasing the `delay_ns` argument) by 10x:

```
mcsherry@Echidnatron compaction % cargo run --release -- 100000
Finished release [optimized] target(s) in 0.04s
Running `target/release/compaction 100000`
1.002224785s max latency: 181.324785ms
2.416583613s max latency: 1.164383613s
3.645712596s max latency: 2.188312596s
6.307347761s max latency: 4.493447761s
13.765729964s max latency: 11.349129964s
45.853110462s max latency: 42.207310462s
^C
mcsherry@Echidnatron compaction %

```

This case is actually worse by a factor of 100x, because we have 10x as many updates each second, and have 10x the number of accumulated records that we need to reconsider for each of those updates.

### An explanation

The problem of course is that as our computation proceeds we have strictly more data. We only have one key in play, but the number of records associated with that key increases unboundedly. Each time we need to refresh our understanding, which happens for each input update, we have to reconsider all prior updates. You might say this is a bad way to update a maximum of an append-only stream, and you are totally right, and one way out of this pickle would be to start to write custom dataflow operators. We really don't want to do that here (they are subtle, and the existing ones are well engineered). However, let's talk through what such an operator does to try and see where the gap is between what differential dataflow does and what we might want it to do. If we were presented with an append-only stream and we wanted to maintain the maximum value, we could write a pretty simple state machine for each key. Each key has an associated value, and when presented with a new value we compare the old and the new values. If there is an improvement, we keep the new value and discard the old. If there is no improvement we keep the old value and discard the new. The common theme here is that when processing input values we are able to effectively discard input values that were no longer interesting to us.

### A warm-up hack we could use

If we just needed to fix the latency stability and memory footprint _**now**_, and weren't embarassed by silly looking solutions, we could just manually update our input stream to retract each input element once we see something in the output that is greater than it is. Here is a fragment that determines the elements we might feel comfortable retracting.

```rust
// Create input and probe handles to use throughput the program.
let mut input = differential_dataflow::input::InputSession::new();
let mut probe = timely::dataflow::ProbeHandle::new();

// Build a dataflow to present most recent values for keys.
worker.dataflow(|scope| {

use differential_dataflow::operators::reduce::Reduce;

// Give input its own name to re-use later.
let input = input.to_collection(scope);

// Determine the most recent inputs for each key.
let results = input
.reduce(|_key, input, output| {
// Emit the last value with a count of 1
let max = input.last().unwrap();
output.push((*max.0, 1));
})
.probe_with(&amp;mut probe);

// Retract any input not present in the ouput.
let retractions = input.concat(&amp;results.negate());
});


```

With `retractions` defined, you could take the initiative to export it from your computation, pull it back in to your computation as a source, and then subtract it from `input`. That doesn't happen automatically or anything. That sounds a bit complicated. Not unbearable, but complicated. Let's do it using differential dataflow itself, instead!

### Self-compacting differential dataflows

We've described an intuition: that input records that do not survive the `reduce` operator can be removed from its input. We have access to the infernal might of differential dataflow. Let's wire up some dataflows with potentially surprising semantics! Differential dataflow has [a `Variable` type](https://docs.rs/differential-dataflow/0.11.0/differential_dataflow/operators/iterate/struct.Variable.html) that is used to construct a reference to a collection before the collection's contents are actually defined. Once you've figured out what the collection should be, possibly it terms of itself, you can `set` that definition. The `Variable` is most often used in an iterative computation, where the next iterate of collection may depend on the output of some computation that depended on its prior iterate. However, these things are more general than that. We don't have to use a `Variable` in an iterative context; we can use them anywhere we want to provide feedback from one part of the dataflow graph back to a prior part. It is difficult to speak too abstractly about `Variable`, so instead let's just write some code down and work through the details. We'll create a `Variable` and name it `retractions`, just like we sort of sketched a few paragraphs ago. The intent is that it should contain records from `input` that we want to remove.

```rust
// Build a dataflow to present most recent values for keys.
worker.dataflow(|scope| {

use differential_dataflow::operators::reduce::Reduce;
use differential_dataflow::operators::iterate::Variable;

// Prepare some delayed feedback from the output.
// Explanation of `delay` deferred for the moment.
let delay = Duration::from_nanos(delay_ns);
let retractions = Variable::new(scope, delay);

// Give input its own name to re-use later.
let input = input.to_collection(scope);

// Determine the results minus any retractions.
let results = input
.concat(&amp;retractions.negate())
.reduce(|_key, input, output| {
let max = input.last().unwrap();
output.push((*max.0, max.1));
})
.probe_with(&amp;mut probe);

// Retract any input that is not an output.
retractions.set(&amp;input.concat(&amp;results.negate()));

});

```

The main changes to notice is that `retractions` is now a `Variable`, rather than a `Collection`. We construct it with some `delay` whose explanation will need to be briefly deferred. We subtract whatever `retractions` is from the input, and then later call `set()` with an argument that appears to be what we defined retractions to be in the code example just up above. Superficially, this seems like it might check out. Even while being 100% unclear about what actually happens. Informally, what happens is that we've turned our `Duration` streaming timestamps into something that does double duty as a loop variable.

### Understanding variables

A `Variable` lets you feed back a collection's contents at some `time` to the top of the dataflow at a strictly later `time + delay`. I personally understand `Variable` by thinking of differential's `Collection` type as a map from times to piles of data. In acyclic dataflows, each collection at each time is defined by collections **strictly before it in the dataflow**, each at times **less or equal to the time in question**. The precise definition of the collection's contents depends on the shape of the dataflow, and what sort of operators got used along the way. The `Variable` type allows us to define collections at each time by **_arbitrary_** other collections in the dataflow, while being restricted to times **strictly less than** the time in question.

---

You might worry that this could create cycles in collection definition, but the important point is that the definitions are still acyclic when we look at the pair of `(collection, time)`. Although collections can depend on themselves, they can only depend on their contents at strictly prior times. If you evaluate the settings of each collection at each time but going in order of times, and within each time in the dataflow order, you find all of the collection contents available to you and can evaluate each collection's contents.

---

Let's talk through an example. Imagine we have an `input` collection with these updates:

```
((key, data1), time1, +1)
((key, data2), time2, +1)
((key, data3), time3, +1)

```

We already know what we _**want**_ the output of the `reduce` to look like, imagining that the `data` advance in time too:

```
((key, data1), time1, +1)
((key, data1), time2, -1)
((key, data2), time2, +1)
((key, data2), time3, -1)
((key, data3), time3, +1)

```

However, we don't actually know that this is what the `reduce` _**does**_ produce, because it depends on its own definition. Instead, we need to start to fill out known values of `retractions` time by time. At `time1`, `retractions` should be the input minus the ouput, which should be empty.

```
// from input
((key, data1), time1, +1)
// from negative output
((key, data1), time1, -1)

```

At `time2`, the input has changed and the output has changed. We still subtract the two, meaning that the updates in `retractions` should be

```
// from input
((key, data1), time1, +1)
((key, data2), time2, +1)
// from negative output
((key, data1), time1, -1)
((key, data1), time2, +1)
((key, data2), time2, -1)

```

A bit of simplification, and this reduces down to

```
((key, data1), time2, +1)

```

This makes sense, because now with `data2` we are comfortable removing `data1` from the input. This is important, because for the first time this will influence the `reduce`. We'll pretend that `delay` is set so that it happens before `time3`, but the results should be correct in any case. At `time2 + delay` the input to the `reduce` changes, retracting `data1`. This does not result in an output change, and nothing else happens downstream. If this _**did**_ result in an output change we would have some crazy dynamics to work out, and we are strongly relying on this not happening to stay sane. It results from our unstated assumptions about "idempotence" (something stronger, it seems) in the operator. At `time3`, the input changes again, which results in a change to the input of and then output of the `reduce`, as indicated up above. Those changes both come together in `retractions`, which now contains

```
// from input
((key, data1), time1, +1)
((key, data2), time2, +1)
((key, data3), time3, +1)
// from negative output
((key, data1), time1, -1)
((key, data1), time2, +1)
((key, data2), time2, -1)
((key, data2), time3, +1)
((key, data3), time3, -1)

```

A bit of simplification again and this reduces down to

```
((key, data1), time2, +1)
((key, data2), time3, +1)

```

Again this makes sense, as we are permitted to retract `data2` as of `time3`. These go around again, and `delay` units after it was dethroned we should delete `data2` from the input.

---

It may take a while to wrap your head around what a `Variable` is and how it works. They are highly non-standard in dataflow programming, and a fundamentally new aspect of differential dataflow over the dataflow processors you are most likely familiar with.

### Understanding the delay

There was that `delay_ns` thing that we pretty casually skipped over. What was that about? When we construct a `Variable` we also create a promise to timely dataflow that our recirculated records will have their timestamps advanced by at least a certain strictly positive amount. In this case, by some minimal `std::time::Duration`. If we had tried to supply a zero value here, things would be a bit of a mess. If nothing else, there is no reason to believe that our variable is well-defined: it could depend on itself at its same time, and that is not ok. At least, that is not ok here in differential dataflow where we want things to be well-defined. But why choose it to be any particular positive value? Could we choose one nanosecond, or should we choose one hour? If you choose the delay to be small, you create a very tight feedback loop in the system. Each time the `reduce` operator is scheduled it asks itself "which times are ready to be acted upon?" If you've only put a nanosecond delay in place, the set of ready times is quite small: just a single nanosecond, because the _**outputs**_ of this nanosecond can influence the _**inputs**_ for the next nanosecond. As you increase the delay larger and larger chunks of time can be carved off and acted upon. With a one second delay, an entire second's worth of work can be peeled off and retired concurrently. Still larger delays allow more even temporal concurrency, which removes one blocker to throughput scaling. If you choose the delay to be large, however, a longer time passes before the updates take effect. With a one hour delay, it takes an hour before retractions are implemented, and the operator will continue to sit on and work with the last hour's worth of data. As you reduce the delay the working set decreases, and the time it takes to correctly handle new updates drops. With a one second delay the operator only maintains the last second of irrelevant updates, greatly reducing the amount of work and state required by the operator. Still shorter delays further reduce the costs associated with the historical data. So you can see that there is a bit of a tension between these two. Also you can see that I think one second is a great number. Let's try that out.

### Trying things out again

Let's start with the debug build, aimed at one input record each millisecond and a delay of one second:

```
mcsherry@Echidnatron compaction % cargo run -- 1000000 1000000000
Finished dev [unoptimized + debuginfo] target(s) in 0.05s
Running `target/debug/compaction 1000000 1000000000`
1.005942535s max latency: 35.942535ms
2.001023689s max latency: 66.752548ms
3.000229937s max latency: 67.729821ms
4.007593941s max latency: 67.729821ms
5.009883423s max latency: 67.729821ms
6.009073795s max latency: 68.069235ms
7.01443526s max latency: 69.382176ms
8.002694929s max latency: 70.878178ms
^C
mcsherry@Echidnatron compaction %

```

This is already substantially more stable than before. For the release build, it turns out that the 10x increased target throughput makes one second too large a delay. Specifically, with 10,000 records a second, this means that each of these updates need to scan roughly that many other updates, about 100 million units of work each second, and that doesn't end up finishing in a second; we've exceeded the system's capacity with this setting. Turning `delay` down to one millisecond works out much better:

```
mcsherry@Echidnatron compaction % cargo run --release -- 100000 1000000
Finished release [optimized] target(s) in 0.04s
Running `target/release/compaction 100000 1000000`
1.000031001s max latency: 2.086667ms
2.000100778s max latency: 2.086667ms
3.000094488s max latency: 2.086667ms
4.000025509s max latency: 2.086667ms
5.000015831s max latency: 2.086667ms
6.000024849s max latency: 2.086667ms
7.000014095s max latency: 2.086667ms
8.00003799s max latency: 2.107374ms
^C
mcsherry@Echidnatron compaction %

```

These knobs can be played with, and to be honest I'm not certain myself of the dynamics. Most of them make sense in retrospect, but I've only just started to use this stuff today.

### More realistic performance

Just a quick throw-away comment that what've we've seen up there is for 1,000 to 10,000 updates per second _**to the same key**_. More realistic data sources would probably have lower update rates per key, which means that the amount of state for each key accumulates slower and we could have a more permissive delay. I don't have a specific "more realistic" stream to play with at the moment, but I know some folks who do and I'll try and ask them to try things out.

### Amazing novelties of wonder

There are some pretty neat advantages to using a dataflow language to describe the compaction techniques. I thought of just a few, but I figured I would call them out.

#### Non-trivial logic for compaction

Keeping the most recent recond is certainly one thing you'll want to be able to do, but it is probably among the simplest. There are other bits of logic that are more complicated, and it can be appealing to be able to write those in more declarative, dataflow-y language. For example, in the NeXMark benchmark, which represents an auction site, auctions are meant to close out at some time, at which point we can certainly delete all bids that did not win the auction. However, as long as the auction is live we probably don't want to do this, to accommodate the possibility that the current leading bid is retracted (e.g. perhaps it was the result of fraud). Once the auction closes, we can produce a collection containing the winner as well as deletions for each of the losers. As another example, we might decide to retain the top 10 most recent records, and delete all others. This allows us to retract some records (up to nine) and still get correct answers. The logic for keeping the top 10 is pretty simple, and less likely to get out of sync than a manual implementation. As a final example, we often see streams of pair `send` and `recv` statements, with some corresponding identifiers (e.g. a network flow and a sequence number). We may want to track the latency, which involves joining the two and subtracting some times. However, once both have landed, we can produce the latency and then subtract both from their inputs, keeping the working state of the dataflow down to the un-paired `send` and `recv` statements.

#### Windows for retractions

Although we discussed setting `delay` to optimize performance, another great use of it is to provide a window for retraction. Any record submitted will have `delay` time units until it is forcibly retracted from the input, which means that it remains visible even if it is not the current maximum. Should the current maximum abdicate, we can still see those values submitted within `delay`, and can recover to any of them.

#### Declarative resource management

I'm still pretty chuffed about how many things you can do without having to hand-roll imperative code to do it for you. If you've ever written that stuff, and had to make it work correctly with out-of-order data, retractions, multi-temporal data (no you haven't) you know it is pretty hard (no you don't).

### Wrapping up

This was all meant to be a really quick introduction about how feedback in differential dataflow, by using `iterate::Variable`, can lead to some really interesting performance considerations. Patterns that might have been hard to express, or required custom operators, can be wired up with relatively simple declarative statements about which data are no longer relevant. In essence, we have been writing rules about how to re-write the input so that the incremental core of differential dataflow acts only on the minimal working set of data that you actually need. As that varies based on operators and use cases, you may need to roll your own rules here. And bonus, all of this is still deterministic, data-parallel dataflow. It makes sense and goes fast.