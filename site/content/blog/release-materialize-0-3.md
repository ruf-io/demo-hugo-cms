---
title: "Release: Materialize 0.3"
category: "Release"
authors: "Albert"
date: "Mon, 01 Jun 2020 18:36:49 +0000"
description: ""
slug: "release-materialize-0-3"
---

We [recently announced Materialize](https://materialize.io/blog-introduction/), a real-time streaming SQL database that powers production applications. The latest release of Materialize, version 0.3, is [now available](https://materialize.io/download/). Materialize lets you ask questions in real-time of your streaming data and get the latest answers back in milliseconds — offering the power and flexibility of a SQL database, but scaling to handle the throughput of tens of thousands of updates per second. Materialize is powered by [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow). Here is a quick overview of the main features in 0.3.

## **What's Changed in Materialize 0.3**

Materialize 0.3 reflects our learnings and improvements as customers stress-test Materialize under high-throughput scenarios (some of our partners have multiple years of transaction history)! We’ve made [many under the hood refinements in v0.3](https://materialize.io/docs/release-notes/#022-rarr-030). Materialize aims to be fully compatible with ANSI SQL, and we’ve been [testing ourselves against CH-Benchmark](https://materialize.io/docs/demos/business-intelligence/), an emerging industry-standard. Release 0.3 improves Materialize’s stability and performance under real-world SQL scenarios we’ve encountered with customers, such as error handling for file sources that can’t be read properly, and runtime error handling.**Correctness and consistency guarantees** provided by Materialize are critical to us, but we also understand that in the real-world, the consistency of databases and data streams may not always be so ideal. Our customers often use change data capture systems such as Debezium can create transaction streams over Kafka from databases like MySQL or Postgres, which are then fed into Materialize [as input sources](https://materialize.io/docs/sql/create-source/). However, these upstream sources may crash or uncleanly restart. To that end, we’ve improved support for scenarios where upstream sources of Materialize send duplicate events, or events that were part of the same transaction have different timestamps. We aim to make Materialize easy to get started and minimize your operational complexity. In our latest release, we’ve further polished [TAIL](https://materialize.io/docs/sql/tail/#main), which continuously updates you on changes that occur to a source or view, allowing you to follow along with ingestion progress. (TAIL exposes some features unique to Materialize, so [follow along here](https://github.com/MaterializeInc/materialize/issues/2919) for more documentation to come). To further improve observability within Materialize, we’ve exposed health checks, export [stream ingestion progress](https://materialize.io/docs/monitoring/) as metrics, and created a pre-configured Grafana dashboard.

### Support for AWS Kinesis sources and enterprise security

Based on customer feedback, we now support ingesting of [JSON over AWS Kinesis streams](https://materialize.io/docs/sql/create-source/json-kinesis/). ([JSON over Kafka is also supported](https://github.com/MaterializeInc/materialize/issues/3176) now; docs coming soon) To support enterprise security requirements, we’ve also added support for SSL and connecting to Kafka clusters over Kerberos.

## **What's Coming in 0.4**

Our product roadmap continues to evolve based on customer and community feedback. Please [get in touch](mailto:sales@materialize.io) if you’d like to chat more!

### Foundations for source data persistence

To provide repeatability for materialized views and avoid having to re-read source data across restarts, we will add support for continuously replicating source data to tiered storage. This will be a multi-release process, but expect to see some progress in 0.4!

### Continuing to evolve sinks

Streaming data from a varied set of sources is just one half of the equation. In release v0.4, we’re making it even quicker and easier to stream data from Materialize [to various sinks](https://github.com/MaterializeInc/materialize/issues/2957).

### Reliability and resilience

We’re continuing to improve Materialize’s resilience to failures on dependencies, such as unexpected data formats and [network issues](https://github.com/MaterializeInc/materialize/issues/2089). As we increase test coverage, run larger load tests, and simulate more complex failure scenarios, we'll continue to solve the issues we discover as well.

## **Get started today**

The full release notes for 0.3 are [located here](https://materialize.io/docs/release-notes/#v030). [Download Materialize](https://materialize.io/download/) today to get faster answers to your data questions, check out our [source code](https://github.com/materializeinc/materialize) on Github, or try out a [pre-built demo](https://materialize.io/docs/demos/business-intelligence/)! We are also [hiring software engineers and SREs](https://materialize.io/careers/)! We're headquartered in New York City, but the SRE position is remote-friendly.