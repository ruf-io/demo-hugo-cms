---
title: "Join Kafka with a Database using Debezium and Materialize"
category: "Deep-dive"
authors: "andy@materialize.com"
date: "Tue, 27 Apr 2021 18:29:34 +0000"
description: ""
slug: "join-kafka-with-database-debezium-materialize"
---

### The Problem

We need to provide (internal or end-user) access to a view of data that combines a fast-changing stream of events from Kafka with a table from a database (which is also changing). Here are a few **real-world examples** where this problem comes up:
* Calculate API usage by joining API logs in Kafka with a user table
* Join IoT sensor data in Kafka with a sensor config table
* Generate affiliate program stats by joining pageviews with an affiliate user table

### Solution: Stream the database to Kafka, materialize a view

The guide below walks through joining Kafka with a database by first streaming the database into Kafka using Debezium to do **c**hange **d**ata **c**apture (CDC), and then using Materialize to maintain a SQL view that joins the two Kafka topics and outputs the exact data needed. (More context on Debezium and Materialize is provided below.)**Our Solution** ![Join Kafka with a Database using Debezium and Materialize](https://user-images.githubusercontent.com/11527560/112652080-65ed9280-8e23-11eb-8d40-93f34a777d91.png) 

#### Why stream the database into Kafka?

The extra step of getting everything into Kafka is necessary because:
* Solutions that query the database on every Kafka event take away the scale and throughput benefits of a message broker by reintroducing limitations of a database.
* Solutions that munge the Kafka data **_back_** into a traditional database where a join can be done eliminate the "real-time" benefits of a stream by falling back to "batch" intervals.

**NOTE:** For PostgreSQL users, Materialize will soon be beta testing a direct Postgres connection that removes the need for Kafka by reading directly from Postgres and the Postgres WAL. [Get in touch](/contact) if interested in testing this out.

#### Important considerations for this approach

The Debezium + Materialize approach to joining Kafka with a database doesn't fit every use case. Consider the following factors:
1. This is **not creating a traditional stream-table join** where Kafka events are enriched (e.g. new fields added) and sent to another Kafka broker because here we are aggregating the data into a materialized view. If you set out to build a stream-table join, this may still be useful to you: one-in-one-out enrichment often ends up in an aggregated view downstream. In those cases, the solution below is an opportunity to remove complexity.
2. It's necessary to use Debezium when **the data in the database is changing**. If the data needed from the database is static **_(e.g. country codes and names)_** the simplest solution is to remove the database dependency entirely and [load the data into Materialize from a file](https://materialize.com/docs/sql/create-source/csv-file/#creating-a-source-from-a-static-csv).

### Table of Contents

The remainder of this guide is split into a conceptual overview followed by a hands-on walkthrough with code examples.
1. **[Learn about the components](#concepts)**  
   * [Debezium](#concepts-debezium)  
   * [Materialize](#concepts-materialize)
2. **[Build the solution](#build)**  
   * [Existing Components (Prerequisites)](#build-prerequisites)  
   * [Debezium](#build-debezium)  
   * [Materialize](#build-materialize)
3. [Conclusion](#conclusion)

---

## Learn about the components

### Debezium

[Debezium](https://debezium.io) is an open-source [Kafka Connect](https://docs.confluent.io/platform/current/connect/index.html) component that listens for changes to a database (`INSERTS`, `UPDATES`, `DELETES`), translates them into change data capture (CDC) events, and pushes them to a message broker. Here's a more tangible example of how Debezium works. Upon running this update query:

```sql
UPDATE my_table SET column_2 = 43 WHERE id = 123;

```

Debezium produces an event like this to a Kafka topic matching the name of the table:

```json
{
    "op": "u",
    "source": {
        "table": "my_table"
        ...
    },
    "ts_ms": 1616428166123,
    "before":{
        "id":123,
        "column_1": "abc",
        "column_2": 42,
        "created_at": "Mon, 15 Mar 2021 12:34:56 GMT",
        "updated_at": "Mon, 15 Mar 2021 12:34:56 GMT"
    },
    "after":{
        "id":123,
        "column_1": "abc",
        "column_2": 43,
        "created_at": "Mon, 15 Mar 2021 12:34:56 GMT",
        "updated_at": "Mon, 22 Mar 2021 15:43:21 GMT"
    }
}

```

The change data capture event contains metadata about the table and the state of the entire row **_before_** and **_after_** the update.

#### Further reading on Debezium

* [Debezium Docs](https://debezium.io/documentation/)
* [Debezium in production at Shopify](https://shopify.engineering/capturing-every-change-shopify-sharded-monolith)

### Materialize

Once all the data is in Kafka, the next step is to join the Kafka-native data and the CDC data in a **materialized view** that outputs the exact structure we need. For that, we use **[Materialize](https://materialize.com/)**, an engine for maintaining views on fast-changing streams of data.

#### What is a materialized view?

Imagine all your data was in a spreadsheet instead of Kafka. The source data would be in massive "Raw Data" worksheets/tabs where rows are continually modified and added. The materialized views are the tabs you create with formulas and pivot tables that summarize or aggregate the raw data. As you add and update raw data, the materialized views are automatically updated.

#### Why use Materialize?

Materialize works well for this problem for a few reasons:
* **Capable of complex joins** \- Materialize has much broader [support for JOINs](https://materialize.com/docs/sql/join/) than most streaming platforms, i.e. Materialize supports all types of SQL joins in all of the expected conditions.
* **Strongly consistent** \- Eventual consistency in a streaming solution can cause unexpected results. Read [Eventual Consistency isn't for Streaming](https://materialize.com/eventual-consistency-isnt-for-streaming/) for more.
* **Simple to configure and maintain** \- Views are defined in standard SQL, and Materialize presents as PostgreSQL, making it easy to connect and query the results from existing PostgreSQL libraries.
Materialize is source-available and free to run forever in a single-node configuration. There's also a private beta of [Materialize Cloud](https://materialize.com/cloud) open for registration.

#### Further reading on Materialize

* [Materialize Docs](https://materialize.com/docs/)
* [Materialize on GitHub](https://github.com/MaterializeInc/materialize)

---

## Build the solution

We'll be using this [`ecommerce-demo` repo](https://github.com/MaterializeInc/ecommerce-demo "https://github.com/MaterializeInc/ecommerce-demo") because it has convenient examples of Kafka-native and database data:
* `pageviews` \- a Kafka-native stream of simulated JSON-encoded web analytics pageview events. **Sample pageview event:**  
```json  
{  
    "user_id": 1234,  
    "url": '/products/56',  
    "channel": 'social',  
    "received_at": 1619461059  
}  
```
* `users` \- a table in a MySQL database with simulated e-commerce shop users with the following attributes:  
```bash  
mysql> DESCRIBE users;  
+------------+---------------------+  
| Field      | Type                |  
+------------+---------------------+  
| id         | bigint(20) unsigned |  
| email      | varchar(255)        |  
| is_vip     | tinyint(1)          |  
| created_at | timestamp           |  
| updated_at | datetime            |  
+------------+---------------------+  
```
The steps below create a real-time join of the `pageviews` in Kafka and the `users` table in the database. The resulting materialized view can be read via a query or streamed out to a new Kafka topic.

### Initialize the starting infrastructure

Start by creating the following infrastructure as Docker containers:

Service

Description

**Kafka + Zookeeper**

The message broker where our pageviews and CDC events are stored.

**Schema Registry**

The Kafka service used by Debezium for CDC message serializing/deserializing using Avro schema.

**MySQL**

The database containing a `user` table which we'll stream to Kafka. [Debezium supports other databases as well](https://debezium.io/documentation/reference/1.4/connectors/index.html).

**Loadgen**

A Python script in a Docker container that produces JSON-formatted `pageview` events directly to Kafka and updates the `users` table in the database.

Before continuing, make sure you have [Docker and Docker-compose](https://materialize.com/docs/third-party/docker) installed. Clone the repo and use the included [`docker-compose.yml`](https://github.com/MaterializeInc/ecommerce-demo/blob/main/docker-compose.yml) file to spin up the above containers.

```shell
git clone https://github.com/MaterializeInc/ecommerce-demo.git
cd ecommerce-demo
docker-compose up -d kafka zookeeper schema-registry mysql loadgen

```

The last line above tells Docker to spin up five specific containers (`kafka`, `zookeeper`, `schema-registry`, `mysql` and `loadgen`) from the `docker-compose.yml` file. All components need network access to each other. In the demo code this is done via a [Docker network](https://docs.docker.com/compose/networking/) enabling services in one container to address services in other containers by name (e.g. `kafka:9092`).

### Start Debezium

Start the Debezium container with `docker-compose`:

```shell
docker-compose up -d debezium

```

This uses the [config specified in `docker-compose.yml`](https://github.com/MaterializeInc/ecommerce-demo/blob/main/docker-compose.yml#L32-L45) to start a container named `debezium` with port `8083` accessible to the host using the `debezium/connect:1.4` image with the environment variables listed below included:

Config

Description

BOOTSTRAP\_SERVERS=`kafka:9092`

The URLs of the Kafka brokers Debezium will be writing events to.

GROUP\_ID=`1`

Required by Kafka Connect, should be unique to Debezium, used to identify the cluster that our service belongs to.

CONFIG\_STORAGE\_TOPIC=`debezium_configs`

Required by Kafka Connect, the Kafka topic where Debezium stores config data.

OFFSET\_STORAGE\_TOPIC=`debezium_offsets`

Required by Kafka Connect, the Kafka topic where Debezium stores connector offsets.

KEY\_CONVERTER=`io.confluent.connect.avro.AvroConverter`

set this optional param in order to use Avro schema instead of default JSON

VALUE\_CONVERTER=`io.confluent.connect.avro.AvroConverter`

Same as above

CONNECT\_KEY\_CONVERTER\_SCHEMA\_REGISTRY\_URL=`http://schema-registry:8081`

Set this optional param to the internal URL and port of our schema registry so Debezium can write/update Avro schema encoding.

CONNECT\_VALUE\_CONVERTER\_SCHEMA\_REGISTRY\_URL=`http://schema-registry:8081`

Same as above

### Point Debezium to MySQL

Debezium is running, but it needs to connect to the database to start streaming data into Kafka. Send the config to Debezium with a `curl` command:

```shell
curl -H 'Content-Type: application/json' localhost:8083/connectors --data '{
  "name": "mysql-connector",
  "config": {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql",
    "database.port": "3306",
    "database.user": "root",
    "database.password": "debezium",
    "database.server.name": "mysql",
    "database.server.id": "1234",
    "database.history.kafka.bootstrap.servers": "kafka:9092",
    "database.history.kafka.topic": "mysql-history",
    "time.precision.mode": "connect"
  }
}'

```

The code above sends JSON-formatted config data to the Debezium container which has its internal port `8083` open externally **_(mapped to host port 8083)_**. Here is more detail on the above configuration variables:

Config

Description

connector.class="io.debezium.connector.mysql.MySqlConnector"

This tells Debezium we're using a MySQL DB.

database.hostname=`mysql`

The hostname of the MySQL DB. In this case, Docker has mapped the `mysql` container name to the container.

database.port=`3306`

The port used by the MySQL database.

database.user=`root`

The MySQL user that Debezium connects as, read about [privileges required by Debezium here](https://debezium.io/documentation/reference/connectors/mysql.html#mysql-creating-user).

database.password=`debezium`

database.server.name=`mysql`

name and id are used to identify the connector in Kafka, the name is used as a prefix on Kafka topics

database.server.id=`1234`

See above

database.history.kafka.bootstrap.servers=`kafka:9092`

Debezium will store the **history** of your database schema in a topic on this broker.

database.history.kafka.topic=`mysql-history`

The topic name for the history log of your DB schema.

time.precision.mode=`connect`

This tells Debezium to use Kafka Connect logical types for timestamps, [read more here](https://debezium.io/documentation/reference/connectors/mysql.html#mysql-temporal-types).

At this point, `debezium` is connected to the `mysql` database, streaming changes into `kafka`, and registering schema in `schema-registry`!

## Start Materialize

Spin up Materialize in Docker:

```shell
docker-compose up -d materialized

```

Materialize is now running in a container named `materialized` with port `6875` accessible to the host.

### Specify data sources in Materialize

Connect to Materialize via the `psql` command-line interface and specify where to find Kafka data using [`CREATE SOURCE`](https://materialize.com/docs/sql/create-source/) statements. For convenience, `psql` is packaged in a Docker container, run:

```shell
docker-compose run mzcli

```

This is equivalent to running `psql -U materialize -h localhost -p 6875 materialize`In the `psql` CLI, create sources for `pageviews` and `users`.

```sql
CREATE SOURCE raw_pageviews
FROM KAFKA BROKER 'kafka:9092' TOPIC 'pageviews'
FORMAT BYTES;

CREATE SOURCE users
FROM KAFKA BROKER 'kafka:9092' TOPIC 'mysql.shop.users'
FORMAT AVRO USING CONFLUENT SCHEMA REGISTRY 'http://schema-registry:8081' ENVELOPE DEBEZIUM;

```

The code above creates two sources, `raw_pageviews`, which is currently just raw `BYTES`, and [append-only](https://materialize.com/docs/sql/create-source/json-kinesis/#append-only-envelope), and `users` from the database via Debezium, which is [Avro-encoded](https://materialize.com/docs/sql/create-source/avro-kafka/) and uses a special [debezium envelope](https://materialize.com/docs/sql/create-source/avro-file/#debezium-envelope-details) that takes advantage of the fact that Debezium provides the old and new data in each message. Create the SQL that converts `raw_pageviews` into typed columns using [`CREATE VIEW`](https://materialize.com/docs/sql/create-view/) syntax:

```sql
CREATE VIEW pageviews AS
  SELECT
    (pageview_data->'user_id')::INT as user_id,
    (pageview_data->'url')::STRING as url,
    (pageview_data->'channel')::STRING as channel,
    to_timestamp((pageview_data->'received_at')::INT) as ts
  FROM (
    SELECT convert_from(data, 'utf8')::jsonb AS pageview_data
    FROM raw_pageviews
  );

```

This is a two-step query that:
1. Encodes raw bytes in UTF8 and casts to Materialize `jsonb` type: `convert_from(data, 'utf8')::jsonb`
2. Uses PostgreSQL JSON syntax `pageview_data->'user_id'` and type casting `::<TYPE>` to extract four fields into typed columns.
At this point, Materialize still hasn't ingested any data because none of the sources or views have been materialized.

### Step 2: Create a materialized view

**Time to join the streams.** Create a materialized view of pageview counts by channel, segmented by VIP and non-VIP users:

```sql
  CREATE MATERIALIZED VIEW pageviews_by_user_segment AS
    SELECT
      users.is_vip,
      pageviews.channel,
      date_trunc('hour', pageviews.ts) as ts_hour,
      count(*) as pageview_count
    FROM users
    JOIN pageviews ON pageviews.user_id = users.id
    GROUP BY 1,2,3;

```

This looks almost identical to traditional SQL. The only special syntax is `CREATE MATERIALIZED VIEW`, which tells Materialize to:
1. Create a dataflow and arrangements (indexes) to compute and maintain the view.
2. Consume all applicable events from Kafka and process them through the dataflow.
3. Once caught up with real time, continue to process new events and maintain the view.
Materialize will maintain the view until it is removed with [`DROP VIEW`](https://materialize.com/docs/sql/drop-view/). No specific time window is necessary. Materialize is joining across all the Kafka events it can ingest. Test the view by running:

```sql
SELECT * FROM pageviews_by_user_segment;

```

Running it multiple times should show the `pageview_count` updating.

## Read output from Materialize

There are two primary ways to access the output of the view, these can be thought of as "poll" (PostgreSQL query) and "push" (Materialize streams output via TAIL or sinks out to a new Kafka topic, downstream service consumes.)

#### Poll Materialize with a PostgreSQL query

If the joined data is only needed **_"upon request",_** for example, in a business intelligence dashboard, admin view, or generated report, a simple PostgreSQL query to the results may be sufficient. In this approach, the downstream application is given credentials to query Materialize as if it were a PostgreSQL database, this also means that many existing PostgreSQL drivers will work out-of-the-box. Here is a very simple Python example that uses the `psycopg2` module to connect to Materialize and fetch data:One key difference between querying Materialize and querying a traditional database is that **Materialize is doing almost no compute work to respond to each query** (the work is done when new data appears in Kafka) so it is perfectly fine to write polling queries that run every second.

#### Stream output via TAIL

Materialize can stream changes to views out via the [`TAIL command`](https://materialize.com/docs/sql/tail/#main). For a practical example of how a downstream application can subscribe to the TAIL command see [A Real Time Application Powered by Materialize’s TAIL Command](https://materialize.com/a-simple-and-efficient-real-time-application-powered-by-materializes-tail-command/).

#### Stream output into a new Kafka topic

If the end goal is better served by streaming data out into another Kafka topic, use a sink. (See [`CREATE SINK`](https://materialize.com/docs/sql/create-sink/) syntax.) The format of events produced to sinks are similar to CDC events described above, where each event consists of a before and after When a sink is first created, by default Materialize pushes an initial snapshot of the table to Kafka, followed by streaming events for each change to the materialized view specified in the sink. Connect to Materialize via `psql` again and add a sink for the view created earlier:

```sql
CREATE SINK pageviews_by_user_segment_sink
FROM pageviews_by_user_segment
INTO KAFKA BROKER 'kafka' TOPIC 'pageviews-user-segment-sink'
FORMAT AVRO USING
    CONFLUENT SCHEMA REGISTRY 'http://schema-registry:8081';

```

The code above takes the materialized view `pageviews_by_user_segment` and creates a sink named `pageviews_by_user_segment_sink` going to a Kafka topic named `pageviews-user-segment-sink` in Avro format.

## Conclusion + Where to go from here

Hopefully, the explanation and code examples above have helped to demonstrate at a conceptual level how Debezium and Materialize can be used as powerful tools for **joining, reducing, and aggregating** high-volume streams of data from **Kafka** and **databases** into whatever output format your use case demands. Moving beyond the conceptual phase, there are several next steps to think about like scaling and load, handling schema evolution, and deployment and maintenance of Materialize. If you have questions or are interested in connecting with others using Materialize, [join the community](https://materialize.com/s/chat) in Slack.