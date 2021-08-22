---
title: "Release: 0.8"
category: "Release"
authors: "amanda"
date: "Mon, 14 Jun 2021 15:35:59 +0000"
description: ""
slug: "release-0-8"
---

[Materialize v0.8](https://materialize.com/docs/release-notes/#v0.8.0) was released on 9 June 2021 with significant improvements and features, including temporal filters, upserts, PubNub sources, S3 sources, and native Postgres sources. Note that the release is also available in [Materialize Cloud](https://materialize.com/docs/cloud/what-is-materialize-cloud/).

## **Key Change:** **Postgres Sources**

We now support POSTGRES sources. We use Postgres's native replication protocol so you can stream updates directly from Postgres databases without needing to set up any other software. Postgres sources are currently available in [experimental mode](https://materialize.com/docs/cli/#experimental-mode). Check out the [technical documentation and examples](https://materialize.com/docs/sql/create-source/postgres/) on how to use it. With Postgres Sources you can:
* Connect to an upstream database with simple username/password authentication or with TLS authentication
* Sync the initial state of the database and seamlessly switch to streaming
* Preserve transaction boundaries across tables
* Use most common column data types
* Try Materialize out by simply running the materialized binary and pointing it to your postgres database, no extra infrastructure needed

## **Key Change: PubNub Sources**

We now support PubNub sources. PubNub is a streaming SaaS provider that provides a set of [public real-time data streams](https://www.pubnub.com/developers/realtime-data-streams/), which are useful for tests and demos, like stock market updates and Twitter streams. The new [Cloud Quickstart](https://materialize.com/docs/cloud/quickstart/) uses a PubNub source. You can now ingest these (and your own PubNub channels) with CREATE MATERIALIZE SOURCE...FROM PUBNUB syntax.

## **Key Change: S3 Sources**

We’ve supported [S3 sources ](https://materialize.com/docs/sql/create-source/)since Materialize 0.7, but for v0.8, we’re lifting the experimental flag. We expect S3 sources to be very useful in unioning old data when you only keep a window of data in Kafka, as well as with materializing a long tail of different machine-produced data from S3.**As a refresher, with S3 sources, you can**:
* Connect to [Amazon S3 object storage](https://aws.amazon.com/s3/?did=ft_card&trk=ft_card)
* [Specify object name filters](https://materialize.com/docs/sql/create-source/text-s3/#scanning-s3-buckets) that ensure Materialize is only downloading and processing the objects you need
* [Hook in](https://materialize.com/docs/sql/create-source/text-s3/#listening-to-sqs-notifications) to AWS’ built-in SQS API for notifying downstream services of bucket/object changes so Materialize can ingest new objects as soon as they appear. Views defined downstream of S3 sources with SQS notifications enabled will incrementally update as new objects are added to the bucket!
* Ingest data from S3 as [raw text/bytes](https://materialize.com/docs/sql/create-source/text-s3/), [CSV](https://materialize.com/docs/sql/create-source/csv-s3/), or [JSON](https://materialize.com/docs/sql/create-source/json-s3/)
* Use [gzip-compressed S3 sources ](https://materialize.com/docs/sql/create-source/text-file/#compression)
**Example of where an S3 source can be useful:**If you only keep recent data in Kafka but have everything in a S3 datalake, you can ingest the S3 data once before starting the Kafka stream to get the full history. In other words, you can combine live Kafka streams with the full history of events from the S3 data lake. Once Materialize downloads an S3 object it will process each line as an event, much like any other source. Users should source S3 buckets where objects are append-only, Materialize will silently ignore deleted or updated objects in S3\. Users can specify which objects should be ingested.

## **Key Change: Volatility**

In 0.8 we introduced a new concept called [Volatility](https://materialize.com/docs/overview/volatility/), which is used to describe sources that can’t necessarily guarantee Materialize access to the exact same complete set of data between restarts. Examples of volatile sources include PubNub and Amazon Kinesis. Specifically, PubNub is a volatile source because it only provides a message queue-like stream of live events. While it is possible to connect to volatile sources in Materialize, the system internally tracks the volatility. Upcoming features that rely on deterministic replay, like [exactly-once sinks](https://github.com/MaterializeInc/materialize/issues/2915) (which are now available in experimental mode), will not support construction atop volatile sources.

## **Key Change: Debezium Upsert Envelope**

We now support Debezium’s upsert envelope, which allows inserts, updates, and deletes to Kafka data streamed to Materialize. The envelope is also compatible with Kafka’s log-compaction feature, and can be useful for users who want to ingest compacted [CDC sources](https://materialize.com/docs/third-party/debezium/) in Materialize.

## **Key Change: Temporal Filters**

[Temporal Filters](https://materialize.com/temporal-filters/) have been graduated from experimental feature status. Temporal filters allow you to limit the memory consumption of Materialize by writing views that only retain data from certain time windows. We’re particularly excited about temporal filters because they enable a lot of commonly requested capabilities like sliding and tumbling windows without forcing the user to break out of their SQL workflow. All you really need is SQL, and the ability to refer to time, to make your data run!

## **Quality-of-life improvements**

* COPY FROM copies data into a table using the [Postgres COPY protocol](https://www.postgresql.org/docs/current/sql-copy.html)
* You can [set offsets](https://materialize.com/docs/sql/create-source/text-kafka/#partition-offsets) for Kafka partitions
* Sort NULLs last, to match the default sort order in PostgreSQL
* New operators and functions:  
   * #> and #>> [jsonb operators](https://materialize.com/docs/sql/types/jsonb/)  
   * New SQL functions, such as pow, [jsonb\_agg\_object](https://materialize.com/docs/sql/functions/jsonb_agg/#main), repeat and encode / decode, to convert binary data to and from several textual representations.  
   * New SQL functions, [trigonometric](https://materialize.com/docs/sql/functions/#trigonometric-func) and [cube root](https://materialize.com/docs/sql/functions/#numbers-func) operators.  
   * [Equality operators](https://materialize.com/docs/sql/functions/#boolean) on [array data](https://materialize.com/docs/sql/types/array/)
* Upsert envelope for [Debezium sources](https://materialize.com/docs/sql/create-source/avro-kafka/#debezium-envelope-details)
* Default [logical-compaction-window](https://materialize.com/docs/cli/#compaction-window) was changed from 60s to 1ms
* Removed [CREATE SINK...AS OF](https://materialize.com/docs/sql/create-sink/#main), which did not have sensible behavior after Materialize restarted. We intend to reintroduce this feature with a more formal model of [AS OF](https://materialize.com/docs/sql/tail/#as-of) timestamps.
* [round](https://materialize.com/docs/sql/functions/#numbers-func) behavior now matches PostgresSQL, in which ties are rounded to the nearest even number, rather than away from zero
* Added default support for encryption-at-rest to [Materialize Cloud](https://materialize.com/docs/cloud/what-is-materialize-cloud/)
* Lots of performance, memory utilization, and usability improvements plus bugfixes!
For the full feed of updates, including upcoming changes, see the [Materialize changelog in docs](https://materialize.com/docs/release-notes/#v0.8.0) and the [Stable Releases](https://materialize.com/docs/versions/). You can install Materialize today [here](https://materialize.com/docs/install/)! Version 0.9 will have additional bug fixes and process improvements in addition to key user-facing features, including decimals and SOC 2 Compliance for [Materialize Cloud](https://materialize.com/docs/cloud/what-is-materialize-cloud/).