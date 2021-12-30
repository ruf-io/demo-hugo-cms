---
title: "Generalizing linear operators in differential dataflow"
category: "Deep-dive"
authors: "mcsherry"
date: "Thu, 29 Apr 2021 13:20:12 +0000"
description: ""
image: "img/generalizing-linear-operators.jpg"
---

Differential dataflows contain many operators, some of which are very complicated, but many of which are relatively simple. The `map` operator applies a transformation to each record. The `filter` operator applies a predicate to each record, and drops records that do not pass it. The `flat_map` operator applies a function to each record that can result in any number of output records. These three methods are all generalized by the `flat_map` method, which you may be able to see with a bit of head scratching. They each have pretty simple implementations; usually just a few lines of code. There are a few more linear operators, slightly more complicated and interesting operators. It turns out that these operators can be generalized as well, though to something more advanced than `flat_map`. In this post we'll work through these more complicated, and very interesting, linear operator and generalize them. It turns out they generalize to an interesting restricted form of join, which is great news for fans of relational algebra! We'll wrap with a discussion of the implications for [Materialize](https://materialize.com/), which unlike differential dataflow has the ability to fuse and optimize these general linear operators.

## Differential dataflow background

Differential dataflow acts on **_streams of updates_**, where each individual update is a triple

```
(data, time, diff)

```

The `data` component describes **_where_** the update occurs: which record experiences the change. The `time` component describes **_when_** the update occurs: at which moment should the change take effect. The `diff` component describes **_what_** the update change is: most commonly, an integer describing the copies of the record to insert or delete. The stream of these triples describe the history of changes to a collection of records. We can transform the update stream into the complete collections at each time. Likewise, we can convert any changing collection to an update stream, just by subtracting from each collection the prior collection. For example, we might imagine a collection of names evolving from an initially empty set to insert and remove various names:

```
("frank", 6, +1)
("frank", 8, +1)
("david", 8, +1)
("frank", 9, -2)

```

This collection starts empty, adds "frank", adds another "frank" and a "david", and then removes "frank" twice. The update stream tells us enough to reconstruct the collection at any time, but it is much more concise. Differential dataflow **operators** act on these streams of updates. Their jobs are to transform their input streams of updates into new output streams of updates, that describe some new changing collection. The `map` operator takes the update stream for one collection and produces the update stream for a collection in which each record was subjected to the map's transformation. The `filter` operator takes the update stream for one collection and produces the update stream for the subset of records that satisfy the predicate. The `join` operator takes the update streams for two collections and produces the update stream for the collection that pairs up records with matching keys. For example, the operator `map(|x| (x, x.len()))`, which appends the length of each name, should transform the above collection of names to:

```
(("frank", 5), 6, +1)
(("frank", 5), 8, +1)
(("david", 5), 8, +1)
(("frank", 5), 9, -2)

```

You can determine this by thinking through what the output collection should look like at each time, and noticing that it changes at the same moments that the input collection changes. In each case, differential dataflow operators should behave as if they were continually re-applying some simple logic to a static collection of data, but instead they act on update streams, changes over time, and produce the corresponding output update streams.

## Linear operators

Some of our operators have the mathematical property of ["linearity"](https://en.wikipedia.org/wiki/Linearity). Specifically,

```
OP(x + y) = OP(x) + OP(y)

```

Linearity means that the operator can be applied record by record if we want. Let's recall the example of the `map(|x| (x, x.len()))` operator. This operator acts independently on each input record. Across a collection of data, it acts on each input record, and accumulates the results. The `map` operator is linear, independent of the action it should apply to each record. It might even be unnatural to think of applying the operator to a collection, as its logic is only defined on individual `data`. The main exciting thing about a linear operator is that it gives us a pretty easy differential dataflow operator implementation. For any single input record `data`, our linear operator applied to the singleton collection `{ data }` produces some output collection `{ datum1, datum2, .., datumk }`. We can implement this operator on update streams by mapping any input update triple `(data, time, diff)` to the output update triples

```
(datum1, time, diff)
(datum2, time, diff)
..
(datumk, time, diff)

```

Notice that one `data` record may produce multiple output updates, and for a collection of many records we should accumulate up all of the output updates. It turns out this is a correct operator implementation! It's also pretty easy to implement, and keeps our `map`, `filter`, and `flat_map` operators simple and performant. Each of those differential dataflow operators are also linear themselves, on update streams not just static collections, which you can double check if you like!

## Even more linear operators

As it turns out, there are some other interesting operators out there. Linear operators! Here are two of the interesting ones:
1. Differential dataflow has an `explode` operator, which is a too-exciting name for an operator that is allowed to produce `diff` information in its output. The `explode` operator maps each `data` to an iterator over `(value, diff)` all of which it then produces for each input. The original intent might be that you'd have accumulations `(key, count)` that you might want to turn in to `count` copies of `key`. The `explode` operator would let you do this efficiently, without actually producing `count` actual copies of `key` (perhaps `count` is enormous). But, the operator is also really interesting because it can produce negative `diff` values, turning a positive record into a negative (and vice versa). This all checks out mathematically, but it can seem a bit weird. It is easy to get wrong.
2. Materialize has a concept of "temporal filter" ([more on that here](https://materialize.com/temporal-filters/)) which is able to transform inequality constraints between `data` and `time` into an operator that adjusts `time`. Concretely, if you say that `time` must live between `lower(data)` and `upper(data)` then the operator can replace each `data` by the updates  
```  
(data, lower(data), +1)  
(data, upper(data), -1)  
```  
These updates defer the introduction of `data` until `lower(data)` and retract `data` at `upper(data)`.

The implementations of these two operators are a bit more subtle than the easier linear operators up above. The `explode` operator needs to be sure to **_multiply_** the input `diff` with the produced `diff`. The temporal filter operator needs to be sure to take the **_maximum_** of the input `time` with those produced by `lower` and `upper`. It also needs to **_multiply_** differences, so that the upper bounds flip the sign of the input update. Each of these operations requires care in their implementation, and things are certainly becoming more complicated. It would be great if there weren't as many special cases!

## All of the linear operators

All of the operators above, and indeed all linear operators, are instances of one **most general** linear operator. Let `logic` be any function from a single record `data` to an update stream (let's say "a set of update triples"). Let `LARGE` be the collection containing the sum over all `data` of the collection `data x logic(data)`, where `x` is [cross product](https://en.wikipedia.org/wiki/Cross_product). This means `LARGE` contains many records of the form `(data, value)`, where `value` is among the things produced by `logic(data)`. The update stream for `LARGE` contains `((data, value), time, diff)` for each `(value, time, diff)` in `logic(data)`. The operator that performs an equijoin (on `data`) between its input and `LARGE` is a linear operator. If you project away the `data` component, keeping only the `value` components, you can represent any linear operator through your choice of `logic` (which determines `LARGE`). The equijoin operator in differential dataflow is not terrible, but it probably isn't obvious how it works. If you have two update streams, each with keys from some common type, say

```
input1 = { ((key, value1), time1, diff1) }
input2 = { ((key, value2), time2, diff2) }

```

then for any pair of updates that have a `key` that matches, we produce as output the update

```
((key, (value1, value2)), lattice_join(time1, time2), diff1 * diff2)

```

This produces a collection of keyed data with pairs of values, at the least time greater than each input time, and with a difference that is the product of input differences. It turns out that these are the updates that produce the key-based matches between the varying collections. Let's work through some examples. We'll need to assume some "minimal time", which I'll take to be `0`.
1. `map(f)`: let `logic(data)` produce `{ (f(data), 0, +1) }`. It describes the collection that always contains exactly `f(data)`. If we join a collection of `data` with `LARGE` and retain `value` we'll get just `f(data)` for present `data`.
2. `filter(p)`: let `logic(data)` produce either `{ (data, 0, +1) }` if `p(data)` is true, or the empty collection otherwise. It describes the collection that always contains either exactly `data` or is empty, based on `p(data)`. If we join a collection of `data` with `LARGE` and retain `value` we'll get just the present `data` satisfying the predicate.
3. `flat_map(f)`: let `logic(data)` produce the set containing `(value, 0, +1)` for each `value` enumerated by `f(data)`. It describes the collection that always contains exactly the collection `f(data)`. If we join a collection of `data` with `LARGE` and retain `value` we'll get just `f(data)` for present `data`.
4. `explode(f)`: let `logic(data)` produce the set containing `(value, 0, diff)` for each `(value, diff)` enumerated by `f(data)`. It describes the collection that is always defined by the updates `f(data)`. If we join a collection of `data` with `LARGE` and retain `value` we'll accumulate the updates for the present `data`.
5. temporal filters: let `logic(data)` produce `{ (data, lower(data), +1), (data, upper(data), -1) }`. It describes the collection that contains `data` exactly from time `lower(data)` until time `upper(data)`. If we join a collection of `data` with `LARGE` and retain `value` we'll get just the present `data` and only from `lower(data)` to `upper(data)`.
In each of these cases, we join our input collection with `LARGE` and then project away `data`. Although perhaps less obvious than we might like, the join implements the correct behavior for the linear operator.

## An implementation

This "general linear operator" has a simple implementation, though one that I find hard to justify verbally without the join analogy. For a timely dataflow stream of `(data, time, diff)` update triples, we can use timely's `flat_map` operator to react to each of these triples. This implementation just follows our statement above about what a differential dataflow join should do, and that the second half of the join is produced by `logic`.

```rust
// Linear operator on a stream of update triples.
// Parameterized by the function `logic`.
self.flat_map(move |(data, time, diff)|
    logic(data)
        .into_iter()
        .map(move |(data2, time2, diff2)|
            (
                data2,                  // new `data2`
                time.join(&time2),      // joined times
                diff.multiply(&diff2),  // multiplied diffs
            )
        )
)

```

For each `data`, we enumerate `logic(data)`, and produce new output updates. The updates have the newly enumerated data, each at the time that is `time` and `time2` merged by the lattice join operator, and with `diff` and `diff2` merged by multiplication. You can also check out the (new) operator `join_function` in [the differential dataflow repository](https://github.com/TimelyDataflow/differential-dataflow), where it looks like (with all of the gory Rust details):

```rust
/// Joins each record against a collection defined by the function `logic`.
///
/// This method performs what is essentially a join with the collection of records `(x, logic(x))`.
/// Rather than materialize this second relation, `logic` is applied to each record and the appropriate
/// modifications made to the results, namely joining timestamps and multiplying differences.
///
/// # Examples
///
/// ```
/// extern crate timely;
/// extern crate differential_dataflow;
///
/// use differential_dataflow::input::Input;
///
/// fn main() {
///     ::timely::example(|scope| {
///         // creates `x` copies of `2*x` from time `3*x` until `4*x`,
///         // for x from 0 through 9.
///         scope.new_collection_from(0 .. 10isize).1
///              .join_function(|x|
///                  //   data      time      diff
///                  vec![(2*x, (3*x) as u64,  x),
///                       (2*x, (4*x) as u64, -x)]
///               );
///     });
/// }
/// ```
pub fn join_function<D2, R2, I, L>(&self, mut logic: L) -> Collection<G, D2, <R2 as Multiply<R>>::Output>
    where
        G::Timestamp: Lattice,
        D2: Data,
        R2: Semigroup+Multiply<R>,
        <R2 as Multiply<R>>::Output: Data+Semigroup,
        I: IntoIterator<Item=(D2,G::Timestamp,R2)>,
        L: FnMut(D)->I+'static,
{
    self.inner
        .flat_map(move |(x, t, d)| logic(x).into_iter().map(move |(x,t2,d2)| (x, t.join(&t2), d2.multiply(&d))))
        .as_collection()
}

```

## Fusing `logic`

We've seen just above that these linear operators are defined by `logic`. The type of logic is that it maps individual `data` records to an iterator over update triples. We also know that if we want to, we could put a bunch of `join_function` calls in sequence.

```rust
// apply a sequence of linear operators.
my_collection
    .join_function(logic1)
    .join_function(logic2)
    .join_function(logic3)

```

Now, that's fine; it will work correctly and everything. However, it does mean that each operator will explicitly produce its results and hand them to the next operator (these are timely dataflow streams, not Rust iterators). Wouldn't it be nice if we could just compose these things? Maybe write something like

```rust
// apply a sequence of linear operators.
let logic = logic1.followed_by(logic2).followed_by(logic3);
my_collection.join_function(logic)

```

It turns out this `followed_by` function is just the logic we've seen up above. We can enumerate the argument iterator, and for each element apply `logic` and yield all of the results. It is even the same `flat_map` operator, just defined on a `self` that is an iterator rather than a timely dataflow stream.

```rust
// Linear operator on a stream of update triples.
// Parameterized by the function `logic`.
self.flat_map(move |(data, time, diff)|
    logic(data)
        .into_iter()
        .map(move |(data2, time2, diff2)|
            (
                data2,                  // new `data2`
                time.join(&time2),      // joined times
                diff.multiply(&diff2),  // multiplied diffs
            )
        )
)

```

This may look like a relatively minor bit of optimization, and that isn't entirely wrong. What this does for us though is put front and center the ability to fuse these operations, which is the first step towards optimizing them. Differential dataflow uses Rust, which will codegen to LLVM which can then do optimizations and that is all great news. What **_I'm_** most interested in is how we can do even more optimization when the operators are expressed declaratively.

## Linear operators in Materialize

[Materialize](https://materialize.com) is, among many other things, a declarative SQL layer on top of differential dataflow. By being declarative, Materialize has the ability to restructure the queries it receives. In particular, it is delighted to take stacks of `Map`, `Filter`, and `Project` actions and fuse them together. This is exceedingly helpful because these linear operators can be fused in to operators like `Join`, and even restructured for multiway joins, where they can substantially reduce the volume of data stored and moved around. However, Materialize stalls out on anything more complicated than the three operations above. Until very recently, it also stalled out on temporal filters, though through some care these can now be fused as well. Unfortunately, they can't yet be fused **_into_** a join, but they do unblock fusing other operators. In addition, Materialize has a great number of special purposed "table valued functions" which are used to implement `flat_map`\-like behavior. For example, you might type something like

```sql
SELECT *
FROM
    my_data,
    generate_series(1, my_data.count);

```

which produces each row of `my_data` as many times as `my_data.count`, with counters that go up and everything. Here `generate_series` is the table valued function, and it is even used as a join! It is basically what we are doing up above with `join_function`! Materialize has a few other tricks that end up with similar situations. The `repeat_row` table valued function can produce negative rows as output, which means it is more `explode` than `flat_map`. The temporal filters mentioned above are grammatically `filter` expressions, but are really more like table valued functions. These cases all live outside the framework of `Map`, `Filter`, and `Project`. So I'm thrilled by the idea that all of these concepts might be unified up into one framework. That unified representation could then be optimized, and fused in to other operators. For those of you using temporal filters, this would allow them to be better pushed down in to joins, and it can reduce their memory footprint substantially in some cases. Internally, some of our CDC format unpacking uses this logic, and jointly optimizing that logic with the SQL you have layered on top of it gives us the ability to unpack and manipulate less. All in all, I'm excited that we might end up reducing the number of concepts that we work with, simplifying things at the same time as we open up new doors for performance. [Join us on Slack](https://materialize.com/s/chat) if you're interested in learning more about the inner-workings of Materialize, and if this sounds like something you'd like to work on, [we're hiring!](https://materialize.com/careers/)