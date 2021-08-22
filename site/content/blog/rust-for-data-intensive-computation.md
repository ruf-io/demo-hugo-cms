---
title: "Rust for Data-Intensive Computation"
category: "Timely"
authors: "mcsherry"
date: "Mon, 22 Jun 2020 15:24:17 +0000"
description: ""
slug: "rust-for-data-intensive-computation"
---

I have some thoughts on the use of [Rust](https://www.rust-lang.org) for data-intensive computations. Specifically, I've found several of Rust's key idioms line up very well with the performance and correctness needs of data-intensive computing. If you want a tl;dr for the post:I've built multiple high-performance, distributed data processing platforms in Rust, and I never learned how to use `gdb` or `lldb`. It just never came up.It's not obviously something to brag about, but I think it speaks volumes about Rust that you can build a reasonable piece of infrastructure without needing to dive in to what specific malfunction the computer is currently effecting; if your program isn't behaving as you expect, it is something you've written staring you in the face. Bona fides: I've been working with Rust for several years now, since late 2014 (before it went 1.0). In that time, I've built [several](https://github.com/TimelyDataflow/timely-dataflow) [pieces](https://github.com/TimelyDataflow/differential-dataflow) of [data](https://github.com/TimelyDataflow/abomonation)\-[processing](https://github.com/frankmcsherry/COST) [infrastructure](https://github.com/frankmcsherry/datafrog) in Rust. In the time before that I led the [Naiad](http://sigops.org/s/conferences/sosp/2013/papers/p439-murray.pdf) project at Microsoft Research, where we built [precursor work on the .NET CLR in C#](https://github.com/TimelyDataflow/Naiad). I'm now at [Materialize](https://materialize.io) where we are building [a system that presents an ANSI SQL interface to live relational data](https://materialize.io/docs/install/), backed by several of these pieces.

## Idiomatic Rust

I wanted to use this short post to call attention to three aspects of Rust that make my life that much easier. There are surely other aspects of Rust that make lives better, but these are my three:
* Types as Guarantees, Destructuring, RAII
* Traits, Closures, and Monomorphization
* Ownership, Borrowing, and Lifetimes
In fact, these three are all instantiations of the same delightful "meta-aspect" of Rust: **codifying software engineering practices in the language**. One of the most personally satisfying ways to think of Rust is as an obstinate code reviewer who insists that your code isn't right until it can be understood by an especially unforgiving reviewer (Rust). Being able to explain the properties of your program _**to Rust**_ makes it more likely you could explain them to more generous readers, or even to yourself in a few months' time. In several cases it even makes the code better, though I treat this as a bonus.

## Types as Guarantees, Destructuring, RAII

You may have heard [Tony Hoare](https://en.wikipedia.org/wiki/Tony_Hoare) refer to null pointers as his "billion dollar mistake". In many languages, just because you have a pointer to data, it doesn't always mean that there is valid data on the other side of the pointer. Maybe your language throws an exception if you try to access the data, maybe your language has undefined behavior instead. In Rust, each object guarantees the validity of the data it references. If you want an "maybe null reference" you need to use the `Option` type, whose contents are protected until you branch on whether the instance is a `None` or a `Some(data)` variant. Throughout Rust, types are used to provide and communicate guarantees that would otherwise be programming convention. Relying on the language, rather than convention, to provide guarantees about data validity results in a lot less time pulling your hair out wondering what mysterious behavior led to the results you are seeing. It also makes for simpler testing, easier PR reviews, and generally more time for the better things in life. Deep in the innards of [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow)'s communication layer, we transit data that may be read-only (if deserialized in place, or if shared with other workers) or which may be mutable. We represent this with a Rust enumeration like so (some details elided):

```rust
/// Either an immutable or mutable reference.
pub enum RefOrMut {
/// An immutable reference.
Ref(&T),
/// A mutable reference.
Mut(&mut T),
}

```

Both variants here are references to data, but with different allowed actions. Rather than hope all users do the right thing based on the variant, specifically not mutate data through immutable references, Rust ensures that you only get access to the references after checking the variant. To write something that extracts the data into another allocation, for example, we must write

```rust
impl RefOrMut {
/// Extracts the contents of `self`, either by cloning or swapping.
///
/// This consumes `self` because its contents are now in an unknown state.
pub fn swap(self, element: &amp;mut T) {
match self {
RefOrMut::Ref(reference) =&gt; element.clone_from(reference),
RefOrMut::Mut(reference) =&gt; ::std::mem::swap(reference, element),
};
}

```

The `match` statement is where we write different code for the two different variants: in the first case we clone the read-only data into the owned resources of `element`, and in the second case we can just swap the data backing the reference in to `element`. In both cases, we only get access to the type of reference in a code region guarded by a test that the reference is the type we expect. There are any number of other ways Rust's types provide guarantees that make writing performant systems code easier, and less error prone. We'll talk this out in more detail in the future with the example of the `Capability` type that drives the coordination of Timely Dataflow's operators, and largely relies on Rust's guarantees to provided system-wide guarantees despite "creative" system users.

## Traits, Closures, and Monomorphization

Traits are Rust's approach to [generic programming](https://en.wikipedia.org/wiki/Generic_programming), in which you write a structure or method in terms of "to-be-specified" types. A great deal of data-processing infrastructure is written without first knowing the type of data to process, nor the specific logic. [Closures](https://en.wikipedia.org/wiki/Closure_(computer_programming)) end up being a way to make the logic generic as well. At compile time, this all gets reduced down to the manually in-lined bit of code you would have copy/pasted in place, and then each hammered independently by LLVM's optimization. What I like most about traits is not only that you can write code once, which is great, but also that when you write that code you state the assumptions you need to make about the types. If you write a hash map you probably need the keys to be 1\. hashable and 2\. equatable, which you will certainly state. However, this is then all you get; you don't get to assume that the keys have a zero value you can use to represent empty hash table slots, or that they have some ordering to break ties. Traits permeate both [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow) and [Differential Dataflow](https://github.com/TimelyDataflow/differential-dataflow). One of the first ones you'll find in Timely Dataflow are the `Data` and `ExchangeData` traits, which mean to describe types that can be transmitted between operators with a worker and between operators across workers, respectively.

```rust
pub trait Data: Clone+'static { }
pub trait ExchangeData: Data + communication::Data { }

```

The `communication::Data` trait requires that a type be `Send` and `Sync`, as well as serializable. These are Rust's way of saying that it is safe to move instances of the types between threads (caveat: it's complicated). For example, a reference-counted allocation can implement `Data` but cannot implement `ExchangeData` (unless it is a `std::sync::Arc`, which uses atomics for reference counting). These traits allow us to write other types, traits, and implementations for arbitrary types that implement these traits. For example, the [`Map` trait](https://docs.rs/timely/0.11.1/timely/dataflow/operators/map/trait.Map.html) (which provides a streaming `map` operator) only requires its input and output types to implement `Data`, because it does not exchange data between workers:

```rust
impl Map<S, D> for Stream<S, D> {
...

```

By constrast, the [`Aggregate` trait](https://docs.rs/timely/0.11.1/timely/dataflow/operators/aggregation/aggregate/trait.Aggregate.html) (which provides a streaming aggregation operator) requires its key and value types to implement `ExchangeData`, because we do expect to exchange them between workers:

```rust
pub trait Aggregate {
...

```

These traits both allow us to implement functionality for many types, but the bounds on the generics ensure that we do this correctly. It would be inappropriate to use `aggregate` on records that are `(String, Rc)`, for example, because the `Rc` type is not thread-safe. Rust would prevent us from making that invocation, without preventing us from using `map` on the same types.

---

Speaking of `map`, which applies a one-to-one transformation to records in an input stream... The `map` operator is an instance of [higher-order programming](https://en.wikipedia.org/wiki/Higher-order_programming), as in addition to its input stream argument it also requires a function describing the logic it should apply to each record. Its signature in Rust looks like

```rust
fn map<D2, L>(&self, mut logic: L) -> Stream<S, D2>
where
D2: Data,
L: FnMut(D)->D2 + 'static,
{
...
}

```

The `map` function has two generic parameters, `D2` for the output data and `L` for the logic to apply. The `D2` type must implement the `Data` trait, described above, but what about this `L` type? The only constraint we impose is that it implements ... `FnMut(D)-&gt;D2 + 'static`, which is a mouthful. The constraint roughly means that `L` can be called as a function, and takes instances of `D` to instances of `D2`. The `'static` thing is a lifetime thing, and just means that `L` should not reference data that might vanish out from under it (like some allocation that someone else owns). However, `L` doesn't have to be a _**function**_, exactly. It is more accurately called a [closure](https://en.wikipedia.org/wiki/Closure_(computer_programming)), which is a bit like a function that can capture data from its invoked environment. For example, we could write a fragment to greet people (described by first name, last name pairs) as:

```rust
let greeting = "Hello:".to_string();
attendees.map(move |(first, last)| {
format!("{} {}", greeting, first)
});

```

The type `L` now owns some data, `greeting`, which it uses in its computation. The closure even has permission to modify this data if it sees fit. You could write

```rust
let mut count = 0;
attendees.map(move |(first, last)| {
count += 1;
format!("Attendee {:?}: {}", count-1, first)
}

```

which would assign increasing numbers to each of the folks in the stream. I don't know that I recommend this, as things go a bit haywire when you use multiple worker threads (the numbers collide). You could start each count at the worker index and increment by the number of workers, though. That should work!

---

All of this trait stuff has the delightful property that it vanishes at compile time. Rust is bright enough to effectively in-line all of the abstraction and present the code as if you had hand-written everything. Except, checked by Rust to be correct. You also communicate, to others and yourself, the assumptions you have made about the generic types you are using.

## Ownership, Borrowing, and Lifetimes

For folks new to Rust, these are the three words that instill existential terror. I've found that with practice they eventually make a great deal of sense, and to my mind they are things you perhaps should have been paying attention to all along. "Ownership" refers to Rust's rule that there is a single owner of each object instance. "Borrowing" refers to Rust's rule that there can be either a single mutable reference to an object or multiple read-only references, but not both, and being clear about which is which. "Lifetimes" are Rust's way of reasoning about the validity of references to objects, to ensure that references don't "out-live" the objects they refer to. These features collectively ensure that Rust itself can understand your program's discipline about allocation, de-allocation, and liveness of objects. The most appealing aspect of these concepts is that Rust asks you to think about them, and makes your life complicated if you decline to do so. Fortunately, they are crucial concepts in data-intensive computation, and putting them right in your face both makes you think about them, and makes your users accept that they are a thing worth thinking about too. An analogy that has helped me, and which works for some folks is that ownership is like statically elidable reference counting, borrowing is like statically elidable reader-writer locks, and lifetimes describe the static region the locks need to be valid for. I'm sure wars have been fought over less, so take what helps you and leave the rest behind.

### Ownership

One of the key ideas that Rust brings to the mainstream is that of "ownership" of data in your program. In Rust, variable bindings "own" the data they bind. The data can only be transferred to other bindings (or in to our out of function calls) by releasing the binding or by explicitly invoking methods that transfer or copy the data. Very few types indeed can be implicitly copied rather than explicitly cloned. There are some caveats here, but the main gist is that ownership makes it much easier to reason about the lifetime of your data, especially including the allocations behind them. In data-intensive computing, reasoning about ownership is both very helpful in understanding resource management, and not nearly as painful as it can be in other application domains. It is helpful in that one of the main costs we face is data movement and data copying, and we can increase our confidence that we minimize this; in the limit, we can even forbid clones and copies of data. It is less painful in that, at least in dataflow computation, the ownership of data transfers naturally through stages of computations; we expect the ownership to change, and the need for concurrent access to the same data is often an anti-pattern already. Let's take an look at an example where ownership helps us. Timely dataflow manages streams of data, and allows you to write operators that manipulate this data. For example, its `map` operator allows you to transform records of one type in to records of another type:

```rust
// Remove whitespace from strings.
attendees
.map(|(mut first, last)| {
//
first.retain(|c| !c.is_whitespace);
first
});

```

This possibly overwrought example demonstrates how the in the course of using the `map` operator, we are able to supply a function that receives ownership of two strings, is able to mutate one, and then pass ownership out to make its way downstream. Several exciting but non-obvious things happen here. First, by receiving owned data we are certain to be the _**exclusive**_ owner, and we are allowed to mutate the data directly; imagine chasing down the bugs that result from shared access to this data, without clarity on who owns the contents. Second, the owned data can be passed along as the output of the function: by providing ownership the caller confirms that it no longer needs the data; this avoids an allocation as we might otherwise need to clone the data for the output. Finally, ownership allows Rust to introduce automatic memory management: we don't pass along `last`, and Rust can immediately deallocate the memory backing it (perhaps we shouldn't have produced it in the first place; a different issue). Many forms of data-intensive computing already respect the idiom of ownership. This is especially true in dataflow computing, where the movement of data itself is what drives the computation. Here, the transfer of ownership is a natural concept, as each datum makes its way through multiple stages of computation.

### Borrowing

Another Rust concept, coupled with ownership, is called "borrowing". Where ownership ensures exclusive access and responsibility for the lifetime of data, "borrowing" represents temporary access to data, which may or may not be exclusive. Borrowing has two flavors "shared" and "mutable", corresponding respectively to "shared" and "exclusive" access to the data (the reason for schism in naming is not clear to me). The best analogy that I have seen is that shared and mutable borrows are the equivalent of [reader and writer locks](https://en.wikipedia.org/wiki/Readers–writer_lock), but whose access patterns the language can statically enforce. Borrowing is the way to access data without taking ownership. Borrows can be created by the owner of the data, and in some cases from borrows of other data (for example, if you borrow a tuple, you can create borrows to its members). For example, in contrast to the `map` method, the `filter` method retain records based on a predicate that can observe but not mutate the record. Its signature is

```rust
fn filter

(&self, mut predicate: P) -> Stream<G, D>
where
P: FnMut(&D)->bool+'static
{
...
}

```

This method is similar to `map`, but the `P` type has a different constraint. Rather than a `FnMut(D)-&gt;D2` it is required to be a `FnMut(&amp;D)-&gt;bool`. The important part here is the `&amp;D`: the predicate is only provided an immutable reference to the input data, which limits what it can do with the argument. As part of determining whether the record should be kept or not, the predicate can inspect but not change the input data. If we had wanted to let the predicate _**change**_ the argument, for example as in the `map_in_place` method, we could have supplied a `&amp;mut D` reference. In each case, the types of references make the contracts between methods clearer. Should a method mutate references in its arguments or not? How can a caller be certain that its callee will not mutate a reference? The two flavors provide guarantees and clarity.

### Lifetimes

Lastly, lifetimes. The `'static` thing you've seen a bit is an example of a lifetime. Lifetimes are Rust's decorations on borrows that indicate for how long Rust can be certain the reference is valid. If you think of borrows as akin to reader-writer locks, they indicate for how long the lock is valid; essentially, at what point would Rust have had to inserted the lock in your code. Lifetimes are important because without them, we have a hard time _**returning**_ references to data. Let's take again the example of `RefOrMut`, which I had previously abbreviated, with all the gory details:

```rust
/// Either an immutable or mutable reference.
pub enum RefOrMut<'a, T> where T: 'a {
/// An immutable reference.
Ref(&'a T),
/// A mutable reference.
Mut(&'a mut T),
}

```

As you can see, there is actually an `'a` thing hanging around in the code, decorating each of the `&amp;` symbols, showing up in the type parameters, and even in some `T: 'a` bound. By giving `'a` a name, we are able to use it connect it to other lifetimes. The explicit use of lifetimes (which Rust can often otherwise elide) allows us to explain to Rust how to connect the dots of the validity of references in our program. For example, we have in the communication layer various ways in which we might receive message contents: serialized as binary, owned Rust types, or shared Rust types. From such a message, we would like to form a `RefOrMut` but need to be clear about for how long it will be valid.

```rust
pub fn as_ref_or_mut<'a>(&'a mut self) -> RefOrMut<'a, T> {
match &mut self.payload { // refs formed here \\
MessageContents::Binary(bytes) => { RefOrMut::Ref(bytes) },
MessageContents::Owned(typed) => { RefOrMut::Mut(typed) },
MessageContents::Arc(typed) => { RefOrMut::Ref(typed) },
}
}

```

The non-obvious thing here is that in each of the three cases, the reference is actually _**formed**_ in the small block of code within the curly braces. Naively, you might worry that as soon as we depart that scope, by returning the result, the reference might expire (a reader-writer lock acquired there certainly would). However, because of the system of lifetimes, Rust can determine that each of the references do remain valid for as long a lifetime as the reference to the input `self`, the message itself. The system of lifetimes allows us to clearly indicate that some references to data are longer-lived than might be expected, which allows us to use references when otherwise we might have to create copies of data. This addresses one of the recurring issues in data-intensive computation.

## Wrapping up

Rust is a pretty neat language. It has some warts, and there are things it could do better for data-intensive computation (a stable ABI, or any other way to transmute references to bytes to references to typed data, is at the front of my list). But I hope you have a read on some of the things that it does that are amazing. To re-iterate, Rust doesn't let you write programs that you couldn't have written in another language. But it does make it so much easier to reason about those programs. When implementing a large-scale, data-parallel, distributed, etc data processor, reasoning about your system is _**so**_ much better than debugging your system. This is doubly true when you are not the only user of your system; having Rust explain to users why they can or cannot do a thing is so much better than reading through bug reports about how a thing just didn't work. So much of what I've enjoyed about Rust is how much more productive it has made me. That time, which would otherwise be spent hitting my head against frustrating bugs, has instead been applied to new features, new algorithms, and progress generally. I invite all of you working in the same space to check it out, and see if you get the same benefits I have. And if you want to check out the fruits of those benefits, check out the source for [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow), [Differential Dataflow](https://github.com/TimelyDataflow/differential-dataflow), and [Materialize, itself](https://materialize.io/docs/install/).