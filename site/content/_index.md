---
title: "Materialize: The streaming database for up-to-date materialized views" 
description: "Materialize is the only true SQL streaming database for building internal tools, interactive dashboards, and customer-facing experiences. It provides the simplicity of SQL queries, but with millisecond-level latency for real-time data."
theme: dark
hero:
  title: The Streaming Database | for Real-time Analytics
  subtitle: Build powerful real-time data products, all in SQL, with
            materialized views that are always up-to-date.
  primary_cta:
    text: See how it works
    url: /get-a-demo/
    collect_email: true
  secondary_cta:
    text: Get started with Materialize Cloud
    url: /cloud-signup
  learn_cta:
    eyebrow: Technical Report
    title: How Materialize Works
    subtitle: Get a technical overview of Materialize and learn about business
      applications of the technology.
    cta_text: Download the Report
    cta_url: /reports/materialize-overview
    image: img/report.png
product_info:
  cta:
    text: Read the Quickstart
    url: https://materialize.com/docs/get-started/
  steps:
    - title: Connect Your Data Sources
      body: Materialize can connect to many different external sources of data without
        pre-processing. Connect directly to streaming sources like Kafka,
        Postgres databases, CDC, or historical sources of data like files or S3.
      reference_links:
        - text: Docs / Create Source
          url: https://materialize.com/docs/sql/create-source/
        - text: Docs / Materialize CDC
          url: https://materialize.com/docs/connect/materialize-cdc/#main
      widget: sources
    - title: Create Real-Time Materialized Views
      body: Materialize allows you to query, join, and transform data sources in
        standard SQL - and presents the results as incrementally-updated
        Materialized views. Queries are maintained and continually updated as
        new data streams in.
      reference_links:
        - text: Docs / What is Materialize?
          url: https://materialize.com/docs/overview/what-is-materialize/
      widget: code-demos
    - title: Build Live Dashboards and Experiences
      body: With incrementally-updated views, developers can easily build data
        visualizations or real-time applications. Building with streaming data
        can be as simple as writing a few lines of SQL.
      reference_links:
        - text: Docs / Business Intelligence Demo
          url: https://materialize.com/docs/demos/business-intelligence/
        - text: Docs / Streaming Microservice Demo
          url: https://materialize.com/docs/demos/microservice/
      widget: output
product_values:
  - icon: img/icon-streaming-joins.svg
    label: Streaming Joins
    title: The Only Platform for | Streaming Joins
    body: >
          While other stream processing tools are limited to basic joins, if any,
          Materialize brings the same powerful join capabilities found in a
          traditional database to streams of data.

          **Materialize Join Capabilities:**

            - [Inner](https://materialize.com/docs/sql/join/#inner-join), [Left (outer)](https://materialize.com/docs/sql/join/#left-outer-join), [Right](https://materialize.com/docs/sql/join/#right-outer-join), [Full](https://materialize.com/docs/sql/join/#full-outer-join) and [Cross](https://materialize.com/docs/sql/join/#cross-join) Joins.
            - Multi-way joins
            - Joins of other Materialized Views
            - [Lateral joins](https://materialize.com/docs/sql/join/#lateral-subqueries)

    cta_text: View Joins Documentation
    cta_url: https://materialize.com/docs/sql/join/
    code:
      code: |-
        CREATE MATERIALIZED VIEW user_join AS
          SELECT
            u.id, SUM(p.amount), last_login
          FROM users
          -- Inner join
          JOIN purchases p ON p.user_id=u.id
          -- Left (outer) join + subquery
          LEFT JOIN
            SELECT user_id, MAX(ts) as last_login
            FROM logins GROUP BY 1
          ) lg ON lg.user_id=u.id
          GROUP BY u.id;
  - icon: img/icon-millisecond-latency.svg
    label: Millisecond Latency
    title: High performance through | incremental computation
    body: >-
      No more choosing between flexibility and speed. Materialize delivers SQL exploration for streaming events and real-time data.

      Rather than recalculating the answer each time it’s asked, Materialize continually updates the answer and gives you the latest result from memory – even in the presence of complex joins and arbitrary inserts, updates, or deletes in the input streams.
    cta_text: Read Key Concepts in Docs
    cta_url: https://materialize.com/docs/overview/what-is-materialize/
    code:
      code: |-
        TEST
  - icon: img/icon-standard-sql.svg
    label: Standard SQL
    title: Streaming made | SQL
    body: >-
      Interact with Materialize in the most common programming language. Lower the burden on your data platform team and reuse skills from traditional SQL queries and applications.

      Materialize supports streaming SQL across the TPC-H benchmark – a standard built for industry-wide relevance, large data volumes, and high query complexity – with incremental updates.
    cta_text: View Materialize Docs
    cta_url: https://materialize.com/docs/
    code:
      code: |-
        TEST
  - icon: img/icon-easy-setup.svg
    label: Easy Setup
    title: Complex queries. | Simple setup.
    body: >-
      New users can get Materialize Cloud up and running in minutes. Rather than spend weeks building microservices, teams can build applications with Materialize in a matter of hours.

      Unlike similar solutions that require pre-processing of data, Materialize connects to data as it exists today – including streaming sources like Kafka, to databases as a read-replica, or from files.
    cta_text: Get Started
    cta_url: https://materialize.com/docs/get-started/
    code:
      code: |-
        TEST
  - icon: img/icon-full-ecosystem.svg
    label: Full Ecosystem
    title: Connect to the full range of | Postgres tools
    body: >-
      Materialize is wire compatible with PostgreSQL, presenting to downstream tools like any Postgres database, simplifying the development of custom applications and streamlining the process of connecting existing data analysis tools.

      Even non-technical users can unlock the most complex real-time queries just using standard BI tooling.
    cta_text: Get Started
    cta_url: https://materialize.com/docs/get-started/
    code:
      code: |-
        TEST
use_cases:
  title: Make Your Analytics Real-Time. | Then Put Your Data to Work.
  body: >
    Materialize empowers anyone within a company to discover insights from real-time data, identify problems immediately, and take action in critical moments. Build operational analytics, real-time visualizations, or connect to off-the-shelf business intelligence tools.

    Once your analytics are real-time, easily build more sophisticated applications:
    
    * Fraud, Risk, and Alerts
    * Logistics, Inventory, and IoT Management
    * Event-Driven Features
    * Personalized Customer Experiences
    * Predictive Machine Learning
  cta:
    text: See all use cases
    url: /use-cases/
  image: img/dashboard.svg
inputs:
  title: Connect a Wide Range of Data Sources
  subtitle: Materialize can connect to many different sources of data - including
    event stream processors, CDC, data lakes, and Postgres databases. View our
    quickstart guide for how to get started today.
  primary_cta_text: See Sources Documentation
  primary_cta_url: https://materialize.com/docs/sources/
  image: img/hero-dataflow.svg
  code:
    code: test
intro:
  heading: test
  text: test
values:
  heading: test
  text: test
---
