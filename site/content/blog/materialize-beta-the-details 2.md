---
title: "Materialize Beta: The Details"
category: "News"
authors: "cdo"
date: "Thu, 20 Feb 2020 17:20:42 +0000"
description: ""
image: "img/materialize-beta-the-details.jpg"
---

We [recently announced Materialize](https://materialize.io/blog-introduction/), the Streaming Data Warehouse. Our first beta release of Materialize, version 0.1, is [available now](https://materialize.io/download/). As a streaming data warehouse, Materialize lets you ask questions of your streaming data and get the latest answers back in milliseconds — offering the power and flexibility of a SQL data warehouse for real-time data. Materialize is powered by [Timely Dataflow](https://github.com/TimelyDataflow/timely-dataflow). Here is a quick overview of the main features in v0.1:

### Incrementally updating results for queries against streaming data

Materialize continuously pulls data from [sources](https://materialize.io/docs/sql/create-source/) and supports the creation of SQL views for fast querying of that data. Version 0.1 supports two types of sources.**Streaming sources** pull data from upstream streaming processors. Currently, we support Kafka as a streaming source. Amazon Kinesis (currently in development) and other stream processors will be supported in future releases. Materialize can natively handle data encoded in the Avro and Protobuf formats, with more formats to come. Support for data from relational databases, such as MySQL and PostgreSQL, is currently provided through support for the [Debezium](https://debezium.io/) CDC format, which adds Kafka compatibility for various databases.**File sources** are the other type of source. These allow you to stream data from locally accessible files. Materialize can optionally pull in new data as it is being appended to the file. CSV files are supported, as are plain text files. Extraction of fields from structured text files, such as log files, is achieved through regular expressions.

### PostgreSQL-based SQL dialect

We support a useful — and growing — set of features from the PostgreSQL dialect of SQL.**Joins** play a critical role when using Materialize. We’ve worked to ensure that our support for joins covers a wide variety of scenarios. Joins may happen between any combination of sources, views. Self-joins and outer joins are also supported. Furthermore, joins between streaming sources (including data from relational databases) and file sources (including CSV and log files) work as expected.**Subqueries** can reference other views and sources. They help structure queries to be more readable and maintainable. Materialize supports using subqueries in view definitions, and can be combined with other features such as aggregates and joins.**Aggregation functions**, including DISTINCT, MIN, MAX, COUNT, SUM, and STDDEV, work in all SQL queries. They are especially effective when paired with GROUP BY, ORDER BY, and LIMIT.**Set operations** combine the results of multiple SELECTs in different ways. We currently support UNION, INTERSECT, and EXCEPT, with each of their DISTINCT and ALL variants.**JSONB columns** allow users to query complex, nested data with powerful SQL functions.**Sharing of indices** **between views** is not commonly supported in streaming SQL and is made possible by the technical foundation ([arrangements](https://timelydataflow.github.io/differential-dataflow/chapter_5/chapter_5.html)) provided by Timely Dataflow.**Preliminary support for Kafka sinks** for streaming of Avro-encoded updates to downstream Kafka consumers. We plan to support other encodings, such as JSON. The [Materialize documentation](https://materialize.io/docs/) contains much more detail about these features.

## v0.2

Work has already started for the next beta release of Materialize. The primary new feature for v0.2 will be support for streaming data from Amazon Kinesis. Other features include various enhancements to Kafka sinks, including the ability to emit JSON records to sinks. We will also continue to enhance user experience, stability, test infrastructure, and performance. We are also working on incorporating [delta joins](https://github.com/frankmcsherry/blog/blob/master/posts/2020-02-15.md) into our SQL query planning. Delta joins can, in certain cases, substantially reduce the intermediate state required for multi-way joins. We’ve implemented preliminary support for delta joins and are analyzing its effect on different query workloads.

## v0.3 and beyond

We are heavily weighing early customer feedback to shape our roadmap. Here are some of the recurring themes.

### Cloud service

Materialize Cloud will be the officially supported, highly available hosted version of Materialize. Customers will be able to quickly launch a Materialize cluster that can stream their data and quickly return results for complex queries. Our skilled team will handle customer support, software upgrades, security patches, and ensuring performance and availability. This will be compliant with SOC 2.

### Extensive support for sources and sinks

Kafka, Kinesis, and local files are only the beginning. It will be simple and fast for Materialize to stream your data from an even more varied set of sources. Similarly, it will also be easy to stream data from Materialize in different ways.

### More sophisticated SQL query planning

The current SQL planning and optimization done by Materialize is a useful foundation for real workloads. However, we know we can do better. We are currently experimenting with [delta joins](https://github.com/frankmcsherry/blog/blob/master/posts/2020-02-15.md), and [worst-case optimal joins](https://github.com/TimelyDataflow/differential-dataflow/tree/master/dogsdogsdogs) are being considered for future inclusion. Optimization of streaming SQL queries is a nascent field of research in which we will continue to invest.

### Persistence of source data

To provide repeatability for materialized views across restarts, we will add support for continuously replicating source data to tiered storage.

### Enterprise integration

We are building Materialize to integrate seamlessly into existing data infrastructure. Ensuring SOC 2 compliance is a process we’ve already started. We will also add critical enterprise features, such as client SSL support and role-based access controls.

### Consistency

Consistency across a set of diverse data sources is an area with scant research. While Differential Dataflow is already consistent, preserving consistency in materialized views requires enriching upstream data sources to preserve transaction information that is currently lost. We are working to strengthen consistency guarantees over time, because streaming SQL need not weaken consistency guarantees. If you don’t see a feature you’re interested in, [please let us know](https://github.com/MaterializeInc/materialize/issues/new/choose)!

## Get started today

[Download Materialize](https://materialize.io/download/) today to get faster answers to your data questions, or check out our [source code](https://github.com/materializeinc/materialize) on Github! We are also [hiring software engineers, SREs, and a product lead](https://materialize.io/careers/)!