---
title: "Release: 0.6"
category: "Release"
authors: "Albert"
date: "Thu, 07 Jan 2021 16:02:54 +0000"
description: ""
image: "img/release-0-6.jpg"
---

[Materialize 0.6](https://materialize.com/docs/release-notes/#v0.6.0) makes it easier to consume streams and build streaming applications. We’ve also made a number of changes that improve our SQL compatibility. Here’s more details on some noteworthy features we’ve added in this release:

## **What’s changed in Materialize 0.6**

**Easily listen to streaming changes** [`TAIL`](https://materialize.com/docs/sql/tail/) is a Materialize-specific command we recently introduced to stream updates from a source, table, or view as they occur. Whereas a SQL `SELECT` statement returns a result that captures a moment in time, a tail operation computes how that relation **_changes_** over time. In 0.6, TAIL is significantly more mature and functional. We’ve made TAIL more reliable, improved ordering semantics, and added more language driver compatibility. We’ve verified support for TAIL in two client libraries, Npgsql (C#) and psycopg2 (Python), and we will continue to add support for more libraries based on user feedback. See our documentation [for examples of how to use TAIL](https://materialize.com/docs/sql/tail/#examples). Also see our [previous blog post](https://materialize.com/streaming-tail-to-the-browser-a-one-day-project/) for an end-to-end example of how to stream updates to a browser.**Non-recursive common table expressions** Common table expressions (CTEs) return a temporary result set that can be used within another SQL statement. CTEs are often used to simplify complex joins and subqueries, and are written with the form `WITH ... AS`. By supporting non-recursive CTEs as of 0.6, Materialize makes it easier to write more expressive SQL and connect with existing libraries and applications.**Supporting the map data type** Materialize now supports a [map type](https://materialize.com/docs/sql/types/map/). This can be useful to model your data more accurately, and is especially helpful when ingesting Avro streams, where we’ve found numerous examples of datasets that utilize maps.**Enterprise-grade encryption** Materialize now has partial support for PostgreSQL’s pgcrypto package. This is useful for enterprise applications, where messages may need to be encrypted/decrypted before they can be properly consumed.**Column defaults** Specifying default values for table columns via the new [`DEFAULT` column option](https://materialize.com/docs/sql/create-table#syntax) in `CREATE TABLE` is now supported. Special thanks to community member [@petrosagg](https://github.com/petrosagg) for his contribution! The full release notes for 0.6 are available here: <https://materialize.com/docs/release-notes/#v0.6.0> 

## **What’s coming in 0.7**

### **Query language user-defined functions**

While the declarative nature of SQL means it is easy to get started, sometimes you wish to do something that isn’t easily expressed with existing SQL statements. In 0.7, we’ll be starting with query language user-defined functions (UDFs), which are reusable SQL functions that execute an arbitrary list of SQL statements. Over time, we intend to evolve this to support more generic UDFs, such as procedural language functions. As an example, we are experimenting with using webassembly, which would enable users to generate functions with javascript. Please join the conversation if there are examples you would be interested in using UDFs for!

### **Deepening connector functionality**

#### _Cloud object storage (S3)_

It goes without saying that cloud-native object storage like Amazon Web Service’s Simple Storage Service (AWS S3) is widely used today, often for data lake and ETL use-cases. With our recent support for file-based data sources and `INSERT` table semantics, a common request has been to [support ingestion of AWS S3 objects](https://github.com/MaterializeInc/materialize/issues/4914). Users have requested the ability to ingest ETL'd data to join live databases with their datalakes, such as with data from periodic data extracts. The first versions of Materialize S3 compatibility will support reading single and multiple static objects according to a pattern. Because there’s a large surface area to cover (various use cases and data formats), we’ll continue to evolve our compatibility over time based on user-feedback.

#### _Upsert semantics and Kafka offsets_

We recently added the ability to specify keys with sinks, which enables greater flexibility consuming Materialize outputs. Next, we’ll be supporting `UPSERT` sink envelopes, which means value deletions will follow the convention of empty values. We’re also adding the ability to consume Kafka streams starting with an offset. Today Materialize consumes a stream of database updates, aka a change-data capture (CDC) stream is only from the beginning, because skipping arbitrary records will cause results to become illogical. However, in practice, we've found that customers will also want to skip records that have corrupted values, or which use an obsolete schema.

### **Get started today**

The full release notes for 0.6 are [located here](https://materialize.com/docs/release-notes/#v0.6.0). [Download Materialize](https://materialize.io/download/) today to get faster answers to your data questions, check out our [source code](https://github.com/materializeinc/materialize) on Github, or try out a [pre-built demo](https://materialize.io/docs/demos/business-intelligence/)! We’re also alpha testing the Materialize Cloud Product now, which includes both hosted and managed solutions. Please [reach out](https://materialize.com/contact/) to request more information if you're interested. You can also [join our growing Slack community](https://join.slack.com/t/materializecommunity/shared_invite/zt-igbcmoxh-5V7XXMBIeDe7PFHO6sG6Dw) to ask questions or to provide feedback on Materialize.