---
title: "Release: Materialize 0.5"
category: "Release"
authors: "Albert"
date: "Tue, 24 Nov 2020 18:22:22 +0000"
description: ""
image: "img/release-materialize-0-5.jpg"
---

We recently released Materialize 0.5! Here’s what’s new and improved.

## **What’s changed in Materialize 0.5**

Version 0.5 includes a number of improvements to help run Materialize in production and connect it to other systems. These include improved Postgres compatibility and beta releases of source caching and tables. As more customers bring Materialize to production, we have focused our efforts on polishing the features it takes to run Materialize reliably and on supporting connections to enterprise infrastructures.

### Expanding our support for Postgres: tables and system catalog

We’ve added more ways to get started with Materialize.**Tables** From day one, Materialize supported the Postgres wire protocol. To make Materialize easy to use, wherever possible we support Postgres’ SQL dialect rather than a pseudo-SQL or a SQL-esque format. This allows you to reuse your existing SQL and minimize migration efforts. To make it easier to send data to Materialize, we now support tables. Tables are great for quickly loading static data into Materialize. You can implement and modify tables with the [CREATE TABLE](https://materialize.io/docs/sql/create-table), [DROP TABLE](https://materialize.io/docs/sql/drop-table), [INSERT](https://materialize.io/docs/sql/insert) and [SHOW CREATE TABLE](https://materialize.io/docs/sql/show-create-table) statements. Tables are conceptually similar to a [source](https://materialize.io/docs/sql/create-source), but the data in a table is managed by Materialize, rather than by Kafka or a filesystem. Note that table data is currently ephemeral: data inserted into a table does not persist across restarts. To handle long-lived data in Materialize, we recommend you pair your table data with [file sources](https://materialize.io/docs/sql/create-source/) and [sinks](https://materialize.com/docs/sql/create-sink/#avro-ocf-sinks).**System Catalog** Materialize now exposes metadata about the running Materialize instance in the new [system catalog](https://materialize.io/docs/sql/system-catalog), which describes the various sources, tables, and views that can be queried via SQL. This is a stepping stone towards improving support of software across the Postgres ecosystem. We’re prioritizing support for Postgres-compatible software based on user feedback, so please don’t hesitate to let us know what you’d be interested in!

### Supporting production deployments

We added a web-based, interactive [memory usage visualization](https://materialize.io/docs/ops/monitoring#memory-usage-visualization) to aid in understanding and diagnosing unexpected memory consumption. This was instrumental in helping reduce Materialize’s memory utilization for a variety of different queries in the 0.5 release.

### Source caching

[Source caching](https://materialize.com/docs/ops/deployment/#source-caching) is a feature we recently introduced to reduce the need to reingest data on Materialize restart in certain scenarios. A common architectural pattern to use with Materialize is to connect it to a database via a data stream such as Apache Kafka. Users who are concerned about disk storage constraints often rely on stream compaction. However, compaction may not always be available; for example, compacting the stream for Change Data Capture (CDC) users would result in incorrect data. Source caching allows these users to speed up Materialize on restart. Source caching is now available for all users as an alpha release. We intend to support cloud-based object storage (such as S3) in subsequent versions of source caching, enabling even easier scaling and operations.

## **What’s coming in 0.6**

We’re making it easier to consume data that has been processed by Materialize. To listen to a continually updated view, we’re extending TAIL to support machine-parsable formats. We’ve [tested this in .Net (Npgsql)](https://github.com/MaterializeInc/materialize/blob/27d163803c24580e38af33680f97c05367532b6f/test/lang/csharp/SmokeTest.cs#L38-L70) and will continue to extend this support to other native SQL drivers. We recently added the ability to write keys in Kafka sink output and will add support for multiple Kafka partitions and UPSERT semantics next. We’re continuing to add more Postgres compatibility by supporting list and map types, as well as non-recursive [common table expressions](https://en.wikipedia.org/wiki/Hierarchical_and_recursive_queries_in_SQL#Common_table_expression) like WITH...AS.

## **Get started today**

The full release notes for [0.5](https://github.com/MaterializeInc/materialize/releases/tag/v0.5.0) are [located here](https://materialize.io/docs/release-notes/#v0.5.0). [Download Materialize](https://materialize.io/download/) today to get faster answers to your data questions, check out our [source code](https://github.com/materializeinc/materialize) on Github, or try out a [pre-built demo](https://materialize.io/docs/demos/business-intelligence/)! You can also [join our growing Slack community](https://join.slack.com/t/materializecommunity/shared_invite/zt-igbcmoxh-5V7XXMBIeDe7PFHO6sG6Dw) to ask questions or to provide feedback on Materialize.