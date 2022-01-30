---
title: "Materialize: The streaming database for up-to-date materialized views" 
description: "Materialize is the only true SQL streaming database for building internal tools, interactive dashboards, and customer-facing experiences. It provides the simplicity of SQL queries, but with millisecond-level latency for real-time data."
sections:
  - type: hero_big
    eyebrow_cta:
      title: We're Hiring
      description: Visit our careers page.
      url: https://materialize.com/careers/
      
    title:  Power of PostgreSQL, | Speed of Redis.
    subtitle: Build data-intensive products without pipelines or caches using
              materialized views that are always up-to-date.
    primary_cta:
      text: Get started for free
      url: https://cloud.materialize.com/account/sign-up
      collect_email: false
    secondary_cta:
      text: Watch a Demo
      url: /get-a-demo
      button: true
    feature_box:
      eyebrow: Technical Report
      title: "Materialize: An Overview"
      subtitle: Get a technical overview of Materialize and learn about business
        applications of the technology.
      cta_text: Read the Report
      cta_url: /reports/materialize-overview
      image: img/report.png
  
  - type: steps
    title: "How Materialize works:"
    steps:
      - title: Getting Data In
        body: Materialize uses structured data (events) as inputs. Events can come from message brokers like **Kafka**, change feeds of databases like **PostgreSQL**, or archived events from **S3**.
        reference_links:
          - text: Docs / Create Source
            url: https://materialize.com/docs/sql/create-source/
          - text: Docs / Materialize CDC
            url: https://materialize.com/docs/connect/materialize-cdc/#main
        widget: sources
      - title: Defining the Schema
        body: Materialize is an engine that takes SQL Queries _(in the form of Materialized Views),_ converts them into dataflows, and processes each write through the dataflow to incrementally maintain the results in-memory.
        reference_links:
          - text: Docs / What is Materialize?
            url: https://materialize.com/docs/overview/what-is-materialize/
        widget: views
      - title: Reading Data Out
        body: |
          Materialized views can be queried like **PostgreSQL**, but response-time is like **Redis.**

          A **stream** of updates can also be **pushed** out to applications or as change events to Kafka.
        reference_links:
          - text: Docs / Business Intelligence Demo
            url: https://materialize.com/docs/demos/business-intelligence/
          - text: Docs / Streaming Microservice Demo
            url: https://materialize.com/docs/demos/microservice/
        widget: output
    cta:
      text: Read the Quickstart
      url: https://materialize.com/docs/get-started/
  - type: logo-cloud
    title: Customer testimonials that | tell the reader we're legit
    subtitle: This isn't just a bunch of smoke and mirrors, look at these real businesses that have not only paid us, but are willing to talk about it.
    logos:
      - name: Drizly
        graphic: 
        url:
      - name: Datalot
        graphic:
        url:
      - name: Kepler
        graphic:
        url:
  - type: alternating-side-by-side-with-images
    title: The missing half of your Database
    subtitle: 
    sections:
      - eyebrow: 
        title: 
        body:
        graphic:
        callouts:
          - title:
            body:
            icon:
          - title:
            body:
            icon:
          - title:
            body:
            icon:
      - eyebrow: 
        title: 
        body:
        graphic:
        callouts:
          - title:
            body:
            icon:
          - title:
            body:
            icon:
          - title:
            body:
            icon:
  - type: tabs
    title: ""
    subtitle: ""
    tabs:
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
  - type: graphic_left_text_right
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
    image: img/use-case.svg
---
