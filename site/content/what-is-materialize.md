---
title: "Materialize: The streaming database for up-to-date materialized views" 
description: "Materialize is the only true SQL streaming database for building internal tools, interactive dashboards, and customer-facing experiences. It provides the simplicity of SQL queries, but with millisecond-level latency for real-time data."
sections:
  - type: slides
    slides:
      - eyebrow: Welcome to Materialize
        title: The Database, Inverted
        body: |
          Traditional databases are built with the assumption:

          > I don't know what queries I'll get, so I'll just be ready to answer anything as quickly as possible.

          You give it a query, and the database scans through indexes and rows to compute the answer.
        builds:
          - body: |
              Materialize flips things around:

              > Give me your queries up front, I'll maintain the answers as data changes.

              Your queries are materialized views that are continually kept up-to-date.

      - eyebrow: How it's useful
        title: Limitations, Inverted
        body: |
          Materialize is a better way to solve scale and speed limits of traditional data architectures:
        graphic:
        question:
          type: single
          descriptor: Use Case
          text: How are you thinking about using Materialize?
          options: ["Data Engineering", "Application Development", "Not sure yet"]
        builds:
          - graphic: |
              Show a scan that joins tables and is slow to compute.
            body: |
              Materialize is a better way to solve scale and speed limits of traditional data architectures:
              
              **Cache Invalidation:** Use views that are always up-to-date in place of caching and denormalization.
          - graphic: | 
              Show a scan that goes down multiple columns of data and is slow to compute.
            body: |
              Materialize is a better way to solve scale and speed limits of traditional data architectures:
              
              **Stale Analytics Data:** Transform and join data in real-time in place of complex batch ELT pipelines.
          - graphic: |
              Show an unknown way of pushing data to other clients after pushing to database.
            body: |
              Materialize is a better way to solve scale and speed limits of traditional data architectures:
              
              **Reactive Databases:** Create seamless reactivity between clients by subscribing to change streams from materialized views.
      - eyebrow: How it works
        title: "Getting Data In"
        body: Materialize uses structured data (events) as inputs. Events can come from message brokers like **Kafka**, change feeds of databases like **PostgreSQL**, or archived events from **S3**.
        question:
          type: "multi"
          text: Where is the data you plan to work with?
          options: ["Kafka", "PostgreSQL", "MySQL", "S3", "Kinesis", "Not sure, just testing"]
      - eyebrow: How it works
        title: "Defining the Schema"
        body: At its core, Materialize is an engine that parses SQL (Joins, aggregations, transformations, computations) into dataflows, and then processes input events in order to maintain the results as an in-memory view.
        question:
          type: "multi"
          text: How do you prefer to create and maintain data schema?
          options: ["CLI", "SQL IDE", "dbt", "Application Framework / ORM", "Cloud UI", "Not sure, just testing"]
      - eyebrow: How it works
        title: Reading Data Out
        body: Materialized views can be queried with the semantics of Postgres and the latency of Redis. OR changes to the view can be **streamed** out of Materialize, either into applications or new Kafka topics, giving you the ability to make fully reactive architectures.
        question:
          type: "multi"
          text: How do you plan on reading data out of Materialize?
          options: ["Kafka (Sinks)", "Queries from language-specific drivers", "Streams from language-specific drivers", "3rd-party Data Tools", "ORMs"]
        builds:
          - body: |
              Materialized views can be queried with the semantics of Postgres and the latency of Redis.
          
              OR changes to the view can be **streamed** out of Materialize, either into applications or new Kafka topics, giving you the ability to make fully reactive architectures.

---
