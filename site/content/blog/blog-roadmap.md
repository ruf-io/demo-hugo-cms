---
title: "Materialize: Roadmap to Building a Streaming Database on Timely Dataflow"
category: "News"
authors: "arjun"
date: "Thu, 11 Jun 2020 16:17:21 +0000"
description: ""
slug: "blog-roadmap"
---

_**How do you build a streaming database from scratch?**_ Building a database is hard work. The usual rules of thumb are that it takes about 10 years to get to a stable system. A beta product can take on the order of ten million dollars of engineering effort. Successful attempts are typically made by teams with over a decade of experience in the field. What’s so hard about building a database? Databases have to deal with the hardest distributed systems challenges, which often require lots of real-world testing to get right. They also suffer from a certain amount of “zero-to-one” bug-fixing. Databases tend to not work **at all** until the last core bug is excised, which is a seemingly never-ending amount of “it’s not working” while you patiently work through to the last bug, at which point it magically starts up. Said another way, it’s hard to build and scope a workable minimal viable product. We started Materialize in early 2019, and today, in summer 2020, you can download and write SQL queries on your streams in seconds:

```bash
$ brew install MaterializeInc/materialize/materialized
$ materialized -w1 &
$ psql -h localhost -p 6875 materialize
> psql (12.3, server 9.5.0)
Type "help" for help.
materialize=> SELECT * FROM your streams!

```

So how do you build a database this quickly, and what comes next?

## Build the engine first

One proven path to building a database is to front-load the risk and build the core database engine first. This is the path of Elasticsearch, which was built on top of the core Apache Lucene engine, a full ten years after Lucene shipped 1.0\. The ten year development cycle is typically outside the scope of an early-stage venture capital funded company (or large corporation with other product lines), which is what makes this an attractive path: do as much as possible before you start that timer. This plan can be described as:
* Build a core database engine
* Stabilize the engine over years of testing, bugfixing, and iteration
* Build a database management system
* Scale the database management system
This is not the only path, but I will note that almost all new OLTP databases in the past decade have at least partially derisked the long development cycle by reusing battle-hardened components, like [RocksDB for the storage engine](https://www.cockroachlabs.com/blog/cockroachdb-on-rocksd/), or [PostgreSQL for the query execution engine](https://blog.yugabyte.com/ysql-architecture-implementing-distributed-postgresql-in-yugabyte-db/).

## Building a cloud-native streaming database

The “engine first” approach is also our chosen path for building Materialize. Building on top of Timely Dataflow, we benefit from the years of experience and bugfixes from being deployed to production in some of the largest Fortune 1000 companies in correctness-critical settings like [Alibaba](http://www.vldb.org/pvldb/vol12/p1099-lai.pdf) and [VMWare](https://github.com/vmware/differential-datalog). Specifying that plan to our situation, our roadmap emerges:
* Step 1: Build a streaming dataflow engine: [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow) \- (2014 onwards)
* Step 2: Stabilize the dataflow engine over years, with [those](https://github.com/TimelyDataflow/differential-dataflow/issues?q=author%3Aryzhyk) [invaluable](https://github.com/TimelyDataflow/timely-dataflow/issues?q=author%3Aryzhyk) [production](https://github.com/TimelyDataflow/timely-dataflow/issues?q=author%3Abmmcq) [bug](https://github.com/TimelyDataflow/timely-dataflow/issues?q=author%3Aqiuxiafei) [reports](https://github.com/TimelyDataflow/timely-dataflow/issues?q=author%3Azjureel)
* Step 3: Build a single-node database management system: [Materialize](https://github.com/MaterializeInc/materialize)  
   * Build out PostgreSQL support (2019)  
   * Persist input streams for efficient replay (2020)  
   * Performance improvements and public benchmarking (2020)
* Step 4: Build cloud-native elasticity and replication: Materialize Cloud  
   * Active-active replication (2021)  
   * Tiered storage (2021)
Materialize - the company - benefits from starting at step 3, after over half a decade of investment in steps 1 and 2\. Given this context, In this blog post I want to lay out in more detail what has already gone into steps 3 and 4, and what more there is to come.

## A single-node streaming database

We believe the path to building a scale-out platform begins with a rock-solid single node streaming database. Existing "big data" systems err by overly focusing on horizontal scalability, only for their clusters to be [outperformed by a single laptop](https://www.usenix.org/system/files/conference/hotos15/hotos15-paper-mcsherry.pdf). We’re focusing on first building a highly performant single-node Materialize database that will outperform competitive systems that have medium sized clusters. To be clear - [Materialize is already distributed](https://materialize.io/docs/cli/#horizontally-scaled-clusters) and already capable of multi-node deployment - but our focus is to build a system so scalable that you won’t need multiple nodes, saving our users on an order of magnitude in hardware costs, on top of better latency, and lower chances of faults.

## What we are building

### Building Dataflows from SQL

[Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow) is a horizontally scalable low-latency dataflow engine, on which [Differential Dataflow](https://github.com/TimelyDataflow/differential-dataflow) builds relational dataflow operators. The core engine is powerful but requires specialist knowledge to use correctly. Materialize’s goal is to make timely dataflows easy to work with for all users. Materialize does this by exposing an abstraction that engineers have been familiar with for decades: PostgreSQL-compatible SQL. In the long run, our users would not even need to know that every SQL view or query gets converted into a data-parallel dataflow, just as the majority of Snowflake users don’t need to know anything about the X100-style columnar execution engine. Successful abstraction layers abstract! We chose to build our SQL layer by building - from scratch - a full-fledged, PostgreSQL-compatible SQL parser, planner, and optimizer, rather than using an off-the-shelf parser/planner (like [Apache Calcite](https://calcite.apache.org/)) or inventing our own dialect. Part of this is simply our belief that ecosystems matter, and the PostgreSQL ecosystem is one of the richest in the world. Rather than forcing users to learn a new dialect, with different behavior, this gives users a much more streamlined path to making use of their streaming data. Second, even though this was the tougher path, several of us had been at [Cockroach Labs](https://www.cockroachlabs.com/), where we already were part of this journey! We thus had a good sense of [where the bodies were buried](https://www.cockroachlabs.com/blog/why-postgres/) when going down this road. PostgreSQL-compatibility opens up a fast path to integrating to a rich ecosystem of tools and products. For instance, it took us about 3 engineer-months to get real-time Business Intelligence from Metabase working on top of Materialize. We estimate it would only take a comparable amount of engineering investment to get several other BI tools, like Looker, to work on top of Materialize. PostgreSQL compatibility is, and will always be, a work in progress. There’s a long tail of usage that we’ll take years to fully complete, but one can break it down into the following compatibility roadmap:
* Compatibility with [the full SQLite test suite](https://github.com/MaterializeInc/sqllogictest). This ensures correctness of SQL semantics for a wide variety of the basic language. This is very close to completeness for the vast majority of users using PostgreSQL drivers.
* Compatibility with [pg\_catalog introspection tables](https://www.postgresql.org/docs/8.4/catalogs.html), which lays the framework for ORM and tooling compatibility.
* Explicit compatibility with ORMs and tools on a one-by-one basis, largely driven by integration testing suites and user demand.

### SQL optimization

Having achieved compatibility with SQLite, we’re focusing our energies on other areas of Materialize rather than racing to pg\_catalog and ORM compatibility. There’s a good reason for this! Optimizing SQL is the more pressing challenge. Optimizing SQL is different in the streaming setting than in the OLTP setting (for an overview of the “classical” approach to SQL optimization, I’d recommend reading [this blog post](https://www.cockroachlabs.com/blog/building-cost-based-sql-optimizer/) on the CockroachDB cost-based optimizer, which is based on [the SQL Server optimizer](http://assets.red-gate.com/community/books/inside-the-sql-server-query-optimizer.pdf)). By and large, in Materialize we optimize to keep the in-memory footprint down, rather than minimizing the compute cost in execution. This takes us “off the beaten path” a little bit from the mainstream database query optimization literature, which predominantly focuses on the latter. The most business-critical valuable streaming SQL queries - in our opinion - are joins. We’ve spent a lot of time on the building blocks that let us perform multi-way joins (e.g. 6-way, 10-way joins over streams) with efficient data structures that don’t require a lot of intermediate state. In our opinion, query plans that require a tree of binary join operators will simply require too much state, which requires cutting down on the state [via hacks like mandatory time windowing](https://docs.ksqldb.io/en/latest/developer-guide/joins/join-streams-and-tables/#join-capabilities). We've already built out a workable SQL optimizer, such that we can spend the rest of the year focusing on execution performance. We do expect that after hitting some execution milestones, in 2021, we will pick back up work on the optimizer.

### SQL Performance

Timely dataflow and differential dataflow are extremely high performance dataflow engines, beating other commercial stream processors by orders of magnitude, depending on the workload. Still, Materialize imposes additional overheads that we hope to smooth out in the coming months. We’ve currently been working on the [TPC-H](http://www.tpc.org/tpch/) queries as our working benchmark, as part of building towards full [chBenchmark](https://db.in.tum.de/research/projects/CHbenCHmark/index.shtml?lang=en) compatibility. Work on fully supporting those queries efficiently has already revealed opportunities for performance optimization. We hope to show comprehensive benchmarks later this year on these queries, which should be closer to the raw differential dataflow performance numbers.

### Stream Persistence

Currently, Materialize relies on external systems (like Kafka) to act as their source of truth for input stream data. If we need to recover that information, for example on a restart or even if someone just pulls in a new source, we need to re-read the information in full. However, many log-based systems don’t maintain compact snapshots of streaming data, and we want to do that for them so that we can start up new queries in milliseconds, rather than minutes. We are actively building stream persistence into Materialize so that when you ingest stream data we can maintain it for you in a compact representation, one that can be efficiently loaded and re-loaded without always returning to your source-of-truth OLTP or Kafka instance. The result is that we only need to replay the heads of your streams upon restart, and can grab the rest of your stream data from the accumulated snapshots we maintain. We’re actively working on stream persistence today, and we intend to have the first version of this feature **ready this summer**.

### There's lots more!

We're working on a whole lot more. Compatibility with more cloud-native streaming sources (Kinesis, Azure Event Hub) as well as cloud-native data lakes, sinking changelogs of views back to streams, and a whole lot more! We're actively interested in user input, so please join the discussion on [GitHub](https://github.com/MaterializeInc/materialize) or [our community Slack](https://join.slack.com/t/materializecommunity/shared_invite/zt-f0qdaz1v-NgGIuxK7Rm1H4AjvJEO8bQ)!

## The Materialize Cloud Elastic Streaming Database

A single node database is only the start of the journey! We think a high performance streaming database will be very useful for a wide variety of customers, but at the largest scales and at the most critical use-cases, two major features will be required: replication and elastic storage. We believe that the majority of database products will be consumed as a cloud service, and [are actively building our cloud product](https://materialize.io/cloud-3)! Furthermore, we believe that both of these features should be designed, from the ground up, for that cloud deployment setting.

### Replication and Virtual Databases

Active-active replication is a requirement for the most stringent use-cases, where the failure of a single node cannot bring down query capability. We believe that active-active replication smoothly fits on top of Materialize, with multiple materialize clusters sitting in front of a standard SQL load balancer. We will begin design work on active-active replication towards the end of the year, with a view to shipping it in early 2021\. Folks who have experience deploying traditional replicated OLTP databases like Postgres, MySQL, or Oracle can have some hesitancy towards active-active replication designs. However, this is because active-active replication is fraught with peril due to the possibility of write-write conflicts that cannot be resolved. In the streaming database setting, where all writes are streamlined through a shared input message bus like Kafka, there is no possibility of such conflicts, making active-active an excellent deployment choice!

### Tiered Storage

One reason we’ve spent some extra time on stream persistence is that we believe that stream persistence is best done with [a full separation of compute and storage](https://medium.com/@ajstorm/separating-compute-and-storage-59def4f27d64). This lets users get the benefit of the economics of low cloud storage costs on tiered storage like S3, compared to databases that don’t have that separation, and where users have to spend large hardware budgets on EBS volumes. Tiered storage also cleanly fits well with replication: we plan for multiple streaming database deployments to share the same underlying tiered storage, making the deployment very similar to Snowflake’s “[elastic data warehouse](http://pages.cs.wisc.edu/~yxy/cs839-s20/papers/snowflake.pdf)” design where users can rapidly spin up sandboxed environments without jeopardizing existing clusters running mission critical streaming jobs. We expect to ship tiered storage towards the latter half of 2021, after active-active replication.

## Putting it all together

I hope that this blog post gives you some additional insight into our near and long term roadmap. If working on building this is something that excites you, [come work with us](https://materialize.io/careers/)! [Download and install](https://materialize.io/docs/install/) Materialize, or [check out the source code](https://github.com/MaterializeInc/materialize) to get started today! Also, please join the discussion on [GitHub](https://github.com/MaterializeInc/materialize) or [our community Slack](https://join.slack.com/t/materializecommunity/shared_invite/zt-f0qdaz1v-NgGIuxK7Rm1H4AjvJEO8bQ)!