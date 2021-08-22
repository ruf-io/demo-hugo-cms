---
hero:
  title: The Streaming Database | for Real-time Analytics
  subtitle: Materialize simplifies how developers build with real-time data, using
    incremental computation to provide low latency, correct answers - all using
    standard ANSI SQL.
  primary_cta:
    text: See how it works
    url: /get-a-demo/
    collect_email: true
  secondary_cta:
    text: Get started with Materialize Cloud
    url: /cloud-signup
  image: img/hero-dataflow.svg
  image_svg: 
  promo_slider:
    - eyebrow: Technical Report
      title: How Materialize Works
      subtitle: Get a technical overview of Materialize and learn about business
        applications of the technology.
      cta_text: Download the Report
      cta_url: /reports/materialize-overview
      image: img/report.png
product_info:
  - label: test
    title: Connect Your Data Sources
    body: >-
      Materialize can connect to many different external sources of data without
      pre-processing. Connect directly to streaming sources like Kafka, Postgres
      databases, CDC, or historical sources of data like files or S3.


      [](https://materialize.com/docs/sql/create-source/)
    cta_text: Docs / Create Source
    cta_url: https://materialize.com/docs/sql/create-source/
    image: img/report.png
    code:
      code: N/A
    icon: img/icon-streaming-joins.svg
product_values:
  - icon: img/icon-streaming-joins.svg
    label: Streaming Joins
    title: The Only Platform for | Streaming Joins
    body: >-
      While other stream processing tools are limited to basic joins, if any,
      Materialize brings the same powerful join capabilities found in a
      traditional database to streams of data.


      **Materialize Join Capabilities:**


      * [Inner](https://materialize.com/docs/sql/join/#inner-join), [Left (outer)](https://materialize.com/docs/sql/join/#left-outer-join), [Right](https://materialize.com/docs/sql/join/#right-outer-join), [Full](https://materialize.com/docs/sql/join/#full-outer-join) and [Cross](https://materialize.com/docs/sql/join/#cross-join) Joins

      * Multi-way Joins

      * [Lateral joins](https://materialize.com/docs/sql/join/#lateral-subqueries)
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
    image: img/icon-streaming-joins.svg
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
