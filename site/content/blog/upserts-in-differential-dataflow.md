---
title: "Upserts in Differential Dataflow"
category: "Deep-dive"
authors: "mcsherry"
date: "Fri, 27 Mar 2020 14:06:04 +0000"
description: ""
slug: "upserts-in-differential-dataflow"
---

"Upserts" are a common way to express streams of changing data, especially in relational settings with primary keys. However, they aren't the best format for working with incremental computation. We're about to learn why that is, how we deal with this in differential dataflow and Materialize, and what doors this opens up!

---

This post is cross-blogged at [my personal blog](https://github.com/frankmcsherry/blog)"Upsert" is a portmanteau of "update" and "insert", and they are (I believe) used primarily in reconciling merges of databases: they allow you to think about inserting and updating data in a consistent framework: each new keyed record either inserts the record (if the key does not yet exist) or updates the value if they key does exist. You can generalize this a bit more to "upsertletes", a new word never to be spoken again, where the sequence of events are pairs of keys and **_optional_** values, for which a missing value communicates the deletion of a record. For example, we might imagine the sequence

```
(frank, mcsherry)   // insert
(frank, zappa)      // update
(frank, None)       // delete
(frank, oz)         // insert
(frank, oz)         // no-op!
(frank, None)       // delete

```

These upserts could be interleaved with those for other keys, and generally describe an evolving keyed relation. Many folks do things this way. For example, Kafka's topic compaction follows this pattern, where keyed payloads can be compacted up to the most recent payload, or dropped if the most recent is a key without a payload. It's one way to manage your ever-growing log, in a way that tries to maintain a bounded memory footprint. Lots of resource-constrained sources also find it much easier just to produce the new values rather than maintain and report prior values; this includes things like IoT devices, but also Postgres by default. Upserts of this form, with deletes, allow you to express an arbitrary history of a keyed collection. They are pretty easy to create, and therefore popular, but are they a good way to do things?

### Upserts vs differential updates

By comparison, differential updates are triples of the form

```
(data, time, diff)

```

The analogy to up above is that `data` corresponds to `(key, val)`, the `time` field was implicit in the sequence above but could (and should) be made explicit, and `diff` explicitly records the positive or negative change in number of occurrences. This format is a bit more demanding. To effect the same sequence as up above, we would need to write down

```
((frank, mcsherry), time0, +1)  // insert
((frank, mcsherry), time1, -1)  // update
((frank, zappa), time1, +1)     // update
((frank, zappa), time2, -1)     // delete
((frank, oz), time3, +1)        // insert
((frank, oz), time5, -1)        // delete

```

There are a few new requirements here: we need to explicitly retract records when there are changes, and we are supposed to keep our mouths shut when nothing is happening (that repeated `(frank, oz)` record needs to not be a thing here). At the same time, this format can be much more expressive. We don't need to have primary keys for records, which mean we can associate multiple values with each key, maintain multisets with multiple copies of the same value, or even not have keys at all if we don't want. While many of your collections may have primary key structure, just as many collections halfway through a dataflow computation may not! Let's take an example computation and see some other ways that the upsert representation can be a bit awkward.

#### Filtering

Imagine we want to take the stream up above and filter it down to just those `(key, val)` pairs where the value starts with a `z`. You can probably see the record I'm thinking of! In differential dataflow a filter is very easy. It is a stateless operator that just applies its predicate to whatever `data` is present in the record, and keeps only those updates that pass the predicate. In the case of the above changes, we would keep records whose value starts with a `z` and the updates would look like

```
((frank, zappa), time1, +1)
((frank, zappa), time2, -1)

```

That's very easy, and it makes that sort of operator really easy to write! And to implement! Filtering with upserts is a bit harder. As best as I understand, you need to take all upserts and replace the value with `None` if the value doesn't pass the test, and you should **_not drop any_** upserts, making the sequence into:

```
(frank, None)
(frank, zappa)
(frank, None)
(frank, None)
(frank, None)
(frank, None)

```

You might like to drop some of those `(frank, None)` records, but it is hard to do so without maintaining state. The upsert it corresponds to might change the value, and with the filter in place it should **_drop_** the corresponding key, but at each moment in time you don't know what that prior value was. You could maintain the collection in memory to track the prior value, but that is now surprisingly more expensive than the stateless differential operator. If you just propagate all updates, your filter didn't do a great job reducing the work you have to do: all downstream operators will need to react to all of these changes, just to check if they should uninstall something.

#### Projection

What if you want to go from our first-name keyed collection to a collection of last names, preserving their multiplicity? In differential this is as easy as replacing each `(key, val)` pair with the data of interest, in this case the `val` field, like so:

```
(mcsherry, time0, +1)
(mcsherry, time1, -1)
(zappa, time1, +1)
(zappa, time2, -1)
(oz, time3, +1)
(oz, time5, -1)

```

How do you do the same thing in the upsert model? You can't, really. The result can be a multiset, and the upsert model doesn't seem to allow that. You could **_count_** each of the last names, using the last name as a key and producing the associated integer as its value. But you have to know that you want to do this, and you'll need to maintain some state to perform the action. What does that look like?

#### Counting

Counting is also pretty annoying with upserts. Let's say you want to maintain a count for each of the values in the collection. In differential dataflow this happens almost natively, as the accumulation of the changes for the data of interest. As above, we project down to the value and simply have updates:

```
(mcsherry, time0, +1)
(mcsherry, time1, -1)
(zappa, time1, +1)
(zappa, time2, -1)
(oz, time3, +1)
(oz, time5, -1)

```

These changes report the changes in counts for each value. With upserts, it's all a lot more complicated. With each upsert you don't know if you are adding or updating a record, which would mean incrementing one count and maybe decrementing another count. When you see a `None` you don't know if you are deleting a record or just doing a no-op because of a prior `None`. You might think you shouldn't see two `None` records in a row, but that happens as soon as you start filtering, remember! It seems like upsert based counting needs to maintain a copy of the collection just to interpret the changes flying at it. That's annoying, especially compared to how easy things were for differential dataflow.

### From upserts to differential updates

Although differential updates are (in my opinion) better for computation, many folks show up with only upserts. This is because they are easier to produce, and put the burden of unpacking them on someone else. That may actually be a reasonable call when the upstream producer is resource constrained, for example with a fleet of IoT devices or an overworked transaction processor; in these cases, anything you can do to offload work from the producer is a smart thing to do! But, once we've reached the data processor, we probably want to pivot to using differential updates. In fact, **_we_** certainly do, because that is how differential dataflow works. So how should we do that?

#### A naive approach

As a first approach, we could write a timely dataflow operator that takes as input a `Stream<(Key, Option)>` and which maintains internally a map from `Key` to `Val`, recording the current association. As the stream of `(Key, Option)` records roll in, the operator can perform the correct updates and produce as outputs the differential updates, including the retraction of specific values. This implementation isn't exceptionally hard, but there are a bunch of details to be careful about. For example, we'll want to buffer input updates until the input timestamp frontier assures us that certain times are closed out, and only process the updates for those times then. This implementation has the down side that it maintains a private copy of the current state of the whole collection. That could be a substantial amount of memory, just to translate the upserts in to differential updates.

#### A more advanced approach

As a second approach, we could consider **_arranging_** the resulting collection, by `key`. Arrangements are a differential dataflow take on shared indexes, which are written to by one writer but can be read from by multiple readers. They allow shared state between multiple dataflow operators, and are especially helpful when multiple readers require the same indexed representation of a collection. The vanilla `arrange` operator takes in a stream of differential updates, `(data, time, diff)`, and builds an arrangement out of them exactly reflecting the changes they indicate. Because the changes are so clearly specified, the operator can determine what to add to the arrangement just from these inputs, without consulting the arrangement itself. But the operator **_could_** consult the arrangement that it is building, if that would somehow help. And the operator could take in `(key, opt_val, time)` inputs rather than `(data, time, diff)` inputs, as supplied by an upsert source. With these timestamped upserts, the operator could look up the current state of each key in the arrangement, and then process the sequence of optional values, adding the correct **_differential updates_** to the arrangement. I did this! Over in [a differential dataflow PR](https://github.com/TimelyDataflow/differential-dataflow/pull/263). The logic isn't very complicated, other than some slightly fiddly interfaces to arrangements. Let's just focus on the part where we have a sequence of `(Key, List<(Time, Option)>)` pairs, stored in some list `to_process`. We've skipped the part where we put all upserts in a priority queue, and where we drain that queue of upserts for times that we are able to process.

```rust
    // Read and write access to the arrangement we're building.
    let (mut trace_cursor, trace_storage) = reader_local.cursor();
    let mut builder = <Tr::Batch as Batch<Tr::Key,Tr::Val,G::Timestamp,Tr::R>>::Builder::new();

    for (key, mut list) in to_process.drain() {

        // Maintains the prior value associated with the key.
        let mut prev_value: Option<Tr::Val> = None;

        // Attempt to find the key in the trace.
        trace_cursor.seek_key(&trace_storage, &key);
        if trace_cursor.get_key(&trace_storage) == Some(&key) {
            // Determine the prior value associated with the key.
            // There may be multiple historical values; we'll want the one
            // that accumulates to a non-zero (ideally one) count.
            while let Some(val) = trace_cursor.get_val(&trace_storage) {
                let mut count = 0;
                trace_cursor.map_times(&trace_storage, |_time, diff| count += *diff);
                assert!(count == 0 || count == 1);
                if count == 1 {
                    assert!(prev_value.is_none());
                    prev_value = Some(val.clone());
                }
                trace_cursor.step_val(&trace_storage);
            }
            trace_cursor.step_key(&trace_storage);
        }

        // Sort the list of upserts to `key` by their time, suppress multiple updates.
        list.sort();
        list.dedup_by(|(t1,_), (t2,_)| t1 == t2);
        // Process distinct times; add updates into batch builder.
        for (time, std::cmp::Reverse(next)) in list {
            if prev_value != next {
                if let Some(prev) = prev_value {
                    // A prior value exists, retract it!
                    builder.push((key.clone(), prev, time.clone(), -1));
                }
                if let Some(next) = next.as_ref() {
                    // A new value exists, introduce it!
                    builder.push((key.clone(), next.clone(), time.clone(), 1));
                }
                prev_value = next;
            }
        }
    }

```

This is the actual implementation, minus some of the fiddly details. For example, we need to be a polite user of the arrangement, and downgrade our access to it to unblock merging. We need to do a bit of merging effort ourselves, because we are the operator in charge of keeping the underlying LSM tidy. Stuff like that. Details in the PR if you'd like! This version has the advantage that the arrangement it uses is the same one we might want to share out to other dataflows **_using_** the collection that results from the upsert stream. If that arrangement is of interest, then this operator comes at no additional memory footprint cost. Of course, if it wasn't interesting, this probably isn't the best way to do things (maybe the hash map, instead!).

### State machines and beyond

What I really like about this pattern is that we can generalize it, from upsert streams to arbitrary state machine logic. We maintain for each key a collection of values, and on each new symbol that arrives (previously a "symbol" was an `Option`) we can consult the values and determine a set of values to add and remove. There doesn't have to be a single value for the key, so we could even do something like a non-deterministic finite automata, if we wanted. What results is an arrangement of the values, all pairs `(key, val)` in the collection and the stream of changes they undergo. This seems like it has some nice potential to generalize input adapters for differential dataflow. As long as you have a keyed stream of events, and a way to describe the values and transitions they undergo in response to events, we should be able to provide you with a differential arrangement of your keyed values. This starts to get us towards things like complex event detection (state machines), but still only really on the boundary of differential computation. We haven't discussed the other direction (updates to upserts) and whether that might eventually be valuable as well!

---

Upserts aren't live in Materialize yet, but if you'd like to get a head start you can check out the [Docs](https://materialize.io/docs/) or [download Materialize](https://materialize.io/download/) and start to play with it. If you'd like to be among the first to learn when upserts land, sign up for the mailing list below!