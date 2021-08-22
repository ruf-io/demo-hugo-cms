---
title: "Release: 0.7"
category: "Release"
authors: "andy@materialize.com"
date: "Tue, 09 Mar 2021 16:00:28 +0000"
description: ""
slug: "release-0-7"
---

[Materialize 0.7](https://materialize.com/docs/release-notes/#v0.7.0) was released on 08 February 2021 with significant improvements around getting data into Materialize.

## Key change: Source data from Amazon Web Services S3

[S3 sources for Materialize](https://materialize.com/docs/sql/create-source/) are fully tested but under the [experimental flag](https://materialize.com/docs/cli/#experimental-mode) until 0.8\. With S3 sources, you can:
* Point Materialize at S3 buckets using the same CREATE SOURCE syntax used for other data.
* [Specify object name filters](https://materialize.com/docs/sql/create-source/text-s3/#scanning-s3-buckets) that ensure Materialize is only downloading and processing the objects you need.
* [Hook in](https://materialize.com/docs/sql/create-source/text-s3/#listening-to-sqs-notifications) to AWS' built-in SQS API for notifying downstream services of bucket/object changes so Materialize can ingest new objects as soon as they appear. Views defined downstream of S3 sources with SQS notifications enabled will incrementally update as new objects are added to the bucket!
* Ingest data from S3 as [raw text/bytes](https://materialize.com/docs/sql/create-source/text-s3/), [CSV](https://materialize.com/docs/sql/create-source/csv-s3/), or [JSON.](https://materialize.com/docs/sql/create-source/json-s3/)
Once Materialize downloads an S3 object it will process each line as an event, much like any other source. Users should source S3 buckets where objects are append-only, Materialize will silently ignore deleted or updated objects in S3.**Examples of where an S3 Source can be useful:** 
1. **Ingest a full history of events.** If you only keep recent data in kafka but have everything in S3, you can ingest the S3 data once before starting the kafka stream to get the full history.
2. **Application logs or database extracts that are stored in S3.** If you're okay with the implicit latency in this approach, you can create views that materialize S3 data joined with kafka as well as upstream databases.

## Quality-of-life improvements

* Kafka sinks now support for [multi-partitions](https://materialize.com/docs/sql/create-sink/#with-options) and can [commit the message offset](https://github.com/MaterializeInc/materialize/issues/5324) back to Kafka when consuming messages.
* Support for [gzip-compressed](https://materialize.com/docs/sql/create-source/text-file/#compression) file sources (support for gzipped s3 sources is [coming soon](https://github.com/MaterializeInc/materialize/issues/5970))
* Allow setting most [command-line flags](https://materialize.com/docs/cli#command-line-flags) via environment variables
* Lots of performance and memory utilization improvements
* New SQL functions, such as [upper](https://materialize.com/docs/sql/functions/#string-func:~:text=upper(s%3A%20str)%20%2D%3E%20str), [lower](https://materialize.com/docs/sql/functions/#string-func:~:text=lower(s%3A%20str)), [ISNULL](https://materialize.com/docs/sql/functions/#boolean:~:text=a%20ISNULL), [ILIKE](https://materialize.com/docs/sql/functions/#boolean:~:text=a%20ILIKE%20match_expr). In particular, thanks very much to [Ronen Ulanovsky](https://github.com/zRedShift) for contributing several [date and time-related functions](https://materialize.com/docs/release-notes/#v0.6.1)!
**A noteworthy breaking change:** As part of the groundwork towards adding user authentication, Materialize now [enforces a valid username when connecting to Materialize.](https://materialize.com/docs/release-notes/#v0.7.0)For the full feed of updates, including upcoming changes, see the [Materialize changelog in docs.](https://materialize.com/docs/release-notes/#v0.7.0)