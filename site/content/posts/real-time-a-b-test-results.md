---
title: "Real-time A/B test results with Segment, Kinesis, and Materialize"
category: "Use Case"
authors: "andy@materialize.com"
date: "Wed, 21 Apr 2021 16:14:37 +0000"
description: ""
image: "img/real-time-a-b-test-results.jpg"
---

## Introduction

This is meant primarily to demonstrate how the Segment + Kinesis + Materialize stack can create new capabilities around querying, joining, and ultimately materializing real-time views of customer-centric data. In this case, we're using A/B testing analytics as the data.**Why?** There's a set of well-known problems and hard-earned lessons that data-centric organizations go through as their use of existing data tools matures. By taking these problems and lessons, thinking back to the customer's core needs (internal or external), and incorporating new technology like Materialize, there's an opportunity to **new data products** that are **dramatically better at serving the customer**. For example, to illustrate why it's helpful to report real-time A/B test results via Materialize, consider the limitations of the alternatives:
1. **Limitations of reporting results in the testing tool:** A/B testing services like Optimizely have great results dashboards; the trouble is getting the correct data in.  
   * **Accuracy of success metrics**: Marketing and Product teams will often run tests that show significant increases in conversion, but upon looking at the bottom line, the expected bump in customers is nowhere to be found. Platform data is complicated, so testing tools usually ask for a "close enough" conversion event like "viewed payment confirmation page." This doesn't always tell the whole story, especially with A/B tests where a variant might artificially inflate one step of the conversion funnel without cascading that win down to the bottom line.  
   * **Granularity of results:** A test showed a 10% improvement in conversion. Was that equal across business and consumer customers? How did it change the average order value? What happened to the cancellation rate for the test group? To answer all these questions, you need to either push _lots_ of data to your A/B test service or use the data warehouse.  
   * **Auditability:** Automated dashboards come with the trade-off that digging into the filtering and measurement logic can be difficult or impossible.
2. **Limitations of reporting results in the data warehouse:** By pushing test analytics to the data warehouse and reporting results there, you solve the problem of access to platform data. You can now join and filter the test analytics and your platform data however you like. But now we've slowed down results to the batch update cadence of the warehouse. If the test is disastrously bad or the test logic isn't coded correctly, you may not know for a full day.

### New possibilities of real-time results

Surfacing the results in real-time materialized views opens up new product-building possibilities that close the test loop and build tighter integrations with the rest of your process. For example:
* Start simple: create a Slack notification with test results as soon as a test reaches statistical significance.
* Simplify the process: Surface real-time results in the CMS where test designs were originally created.
* Automate: closed-loop testing where the winning variant automatically deploys once the test reaches significance with a clear winner.

### Watch the video

The article below is also published in video form: 

### About the tech stack

**[Segment](https://segment.com)** is a popular customer data platform (CDP) that collects, organizes, and moves around data with a variety of Sources (data inputs) and Destinations (data outputs):
1. **Data Sources** \--- Segment makes it easy to send customer-centric data like pageviews, registrations, purchases, etc... **_into_** their service. We'll be using the Segment JS library to generate input data.
2. **Data Destinations** \--- Segment can stream data back out to various 3rd party tools and services; we'll be turning on their **AWS Kinesis** destination to stream all the data directly out to Kinesis.
**[AWS Kinesis](https://aws.amazon.com/kinesis/)** is a "Kafka as a service" product. For our purposes, this is useful because Segment has a built-in Kinesis connector, and we can quickly create and configure a Kinesis Stream in the AWS console.**NOTE:** As of 4/15/2021, Kinesis support in Materialize is undergoing active development and is in Alpha status. If you run into any issues with it, please let us know with a [GitHub issue](https://github.com/MaterializeInc/materialize/issues/new?labels=C-bug&template=bug.md).**[Materialize](https://materialize.com/)** is a new kind of engine for maintaining views on fast-changing data. You can think of it as between a database and a stream processor. It connects to a message broker like Kinesis or Kafka and ingests events through dataflows into **materialized views** that we define using standard SQL. A materialized view is a real-time reduction or aggregation of raw data into a more useful form. For a common real-world example, a pivot table in an Excel spreadsheet is a kind of materialized view. We will be pointing Materialize at our Kinesis stream and writing SQL queries to materialize real-time views of our test results.

### The Plan

1. Send "Experiment Viewed", "Experiment Clicked" events from website to Segment.
2. Configure Segment to send everything to Kinesis.
3. Connect Materialize to Kinesis and create real-time views of the data.

## Step 1: Send Events to Segment

The events below are meant to be sent from the visitor's browser to Segment as they interact with tests. A/B test services like Optimizely will automatically include these events as part of their Segment integration. The events only need a couple of attributes because [Segment's analytics.js library](https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/) automatically adds the standard web analytics fields like timestamps, URL info, referrer, UTM codes, `user_id` if the visitor is known and `anonymous_id`, a cookie used to track anonymous users across pageviews.

### Experiment Viewed

Segment has a pre-defined structure for A/B Testing events named `Experiment Viewed`. At a minimum, the experiment viewed event needs the following attributes:

```javascript
analytics.track('Experiment Viewed', {
  experimentName: 'Homepage Hero CTA',
  variationName: 'Variant: Count me in!',
});

```

`experimentName` identifies which experiment the visitor viewed, and `variationName` identifies the specific variation. Every experiment has at least two variations (test and control.) Use descriptive variation names (`Variant: Count me in!` not `Variant 1`) so it's easy to remember which variant is which in the results dashboards.

### Experiment Clicked

This is a custom event used as a "leading indicator" of experiment results. Fire the event when a user clicks the goal action of any experiment.

```javascript
analytics.track('Experiment Clicked', {
  experimentName: 'Homepage Hero CTA',
  variationName: 'Variation: Count me in!',
});

```

The only difference here is the event name: `Experiment Clicked`. The "Clicked" event doesn't prove that the user performed the target conversion, but it is a good sign of engagement and will be used to get a quick read on performance.

### Other Data

We need to give Materialize access to other platform data to use it in real-time joins and filters with test analytics.**Options for getting platform data to Materialize:** 
1. **Send platform data to Segment** \- This is most accessible and is likely already happening if you are using Segment. Send other customer-centric data to Segment in the form of additional `track` and `identify` events, Segment will stream them to Kinesis where Materialize can consume and join with the test analytics.
2. **Stream a database directly to Kinesis with change data capture** \- This is more powerful because it gives Materialize access to entire tables from a database. But it's also more difficult because it requires setting up a service like Debezium to stream database changes directly to Kinesis.
3. **Coming Soon: Connect Materialize to a PostgreSQL DB.** If platform data is stored in a PostgreSQL database, Materialize will soon be able to connect directly to it and materialize real-time views that include data from PostgreSQL tables.

## Step 2: Turn on Kinesis Destination in Segment

Follow the [Segment to Amazon Kinesis documentation](https://segment.com/docs/connections/destinations/catalog/amazon-kinesis/#getting-started) to begin forwarding Segment events into Kinesis. Once correctly configured, you should have: - A Kinesis stream. - An IAM Policy and Role set up to allow Segment to write to Kinesis - The Kinesis destination enabled in the Segment UI with the region, role address, secret ID, and stream name defined. (Secret ID corresponds to the external ID specified during IAM role creation.)

## Step 3: Materialize

### Configure Materialize access to Kinesis

For Materialize, we also need to create an IAM policy and User in the AWS IAM console with the permissions required by the [Materialize Kinesis Source](https://materialize.com/docs/sql/create-source/json-kinesis/#raw-byte-format-details):
1. Create a new IAM policy granting Materialize `List` and `Read` access to your Kinesis stream.  
```javascript  
{  
  "Version": "2012-10-17",  
  "Statement": [  
      {  
        "Effect": "Allow",  
        "Action": [  
          "kinesis:ListStreams",  
          "kinesis:SubscribeToShard",  
          "kinesis:DescribeStreamSummary",  
          "kinesis:ListShards",  
          "kinesis:DescribeStreamConsumer",  
          "kinesis:GetShardIterator",  
          "kinesis:GetRecords",  
          "kinesis:DescribeStream",  
          "kinesis:DescribeLimits",  
          "kinesis:ListStreamConsumers",  
          "kinesis:ListTagsForStream"  
        ],  
        "Resource": "*"  
      }  
  ]  
}  
```
2. Create a new IAM user for Materialize with Programmatic Access. When adding Permissions, click "Attach existing policies directly" and select the IAM policy from step 1\. Once created, save the Access Key and Secret Key to use in Materialize.
3. Materialize [looks in several places for AWS credentials](https://materialize.com/docs/sql/create-source/json-kinesis/#with-options) \- For this guide, we can just provide them in the `CREATE SOURCE` SQL

### Install and run Materialize

[Install Materialize](https://materialize.com/docs/install/), then [run the materialized binary](https://materialize.com/docs/get-started/) and connect to it with `psql` in a new terminal with:

```bash
psql -U materialize -h localhost -p 6875 materialize

```

### Create the Kinesis source

In the psql CLI, create a single source for all Segment events by specifying the ARN and access keys:

```sql
CREATE SOURCE kinesis_source
FROM KINESIS ARN 'arn:aws:kinesis:{region}:{account_id}:stream/{stream-name}'
WITH (access_key_id='{access_key}', secret_access_key='{secret_access_key}')
FORMAT BYTES;

```

Nothing is ingested yet. This only tells Materialize how to fetch messages when a materialized view is created later.

### Create intermediary views to format the JSON and typecast the columns

Kinesis sources are initially ingested as a single column of raw bytes representing the message. Since we know our messages are JSON formatted, the first step is to [convert the raw data to utf8 and then JSON](https://materialize.com/docs/sql/create-source/json-kinesis/#extracting-json-data-from-bytes):

```sql
CREATE VIEW kinesis_json AS
  SELECT CAST(data AS JSONB) AS data
  FROM (
    SELECT CONVERT_FROM(data, 'utf8') AS data
    FROM kinesis_source
  );

```

We are using a regular [`VIEW`](https://materialize.com/docs/sql/create-view/) (as opposed to a [`MATERIALIZED VIEW`](https://materialize.com/docs/sql/create-materialized-view/)) here as a sort of SQL template that we will reference later in multiple materialized views. Create more templates to cast specific JSON attributes into columns for `Experiment Viewed` and `Experiment Clicked` events:

```sql
CREATE VIEW experiment_viewed AS
    SELECT
    (data->>'anonymousId') as anonymous_id,
    (data->'properties'->>'experimentName') as experiment_name,
    (data->'properties'->>'variationName') as variation_name,
    (data->'context'->'page'->>'referrer') as referrer,
    (data->'context'->'page'->>'url') as url,
    (data->>'receivedAt') as received_at
  FROM kinesis_json
  WHERE (data->>'event') = 'Experiment Viewed';

```

```sql
CREATE VIEW experiment_clicked AS
    SELECT
    (data->>'anonymousId') as anonymous_id,
    (data->'properties'->>'experimentName') as experiment_name,
    (data->'properties'->>'variationName') as variation_name,
    (data->'context'->'page'->>'referrer') as referrer,
    (data->'context'->'page'->>'url') as url,
    (data->>'receivedAt') as received_at
  FROM kinesis_json
  WHERE (data->>'event') = 'Experiment Clicked';

```

This may look a little different with the [JSON notation](https://materialize.com/docs/sql/types/jsonb/#notes-about-converting-jsonb-to-text), but it's 100% standard Postgres SQL. The `->` notation is the Postgres way of drilling into nested JSON objects, and the `->>` indicates the referenced value should be cast as text. These are still not materialized, so no data is being streamed in yet.

### Materialize a view

Now let's materialize a view of the initial engagement of an experiment by joining views and clicks:

```sql
CREATE MATERIALIZED VIEW experiment_results AS
  SELECT
    v.experiment_name,
    v.variation_name,
    v.uniques as unique_views,
    v.impressions as total_views,
    c.uniques as unique_clicks,
    c.impressions as total_clicks
  FROM (
    SELECT
      experiment_name,
      variation_name,
      COUNT(DISTINCT(anonymous_id)) AS uniques,
      COUNT(*) AS impressions
    FROM experiment_viewed
    GROUP BY 1, 2
  ) v
  LEFT JOIN (
    SELECT
      experiment_name,
      variation_name,
      COUNT(DISTINCT(anonymous_id)) AS uniques,
      COUNT(*) AS impressions
    FROM experiment_clicked
    GROUP BY 1, 2
  ) c ON
    c.experiment_name = v.experiment_name AND
    c.variation_name = v.variation_name;

```

This is also standard SQL, but since we're in a [streaming SQL](https://materialize.com/streaming-sql-intro/) paradigm when the statement above is executed, Materialize:
1. Builds a dataflow to match the SQL above,
2. Uses the source info to consume all events from Kinesis,
3. Runs each event through the dataflow to incrementally calculate the view,
4. Continues to consume new events from Kinesis, incrementally updating the output accordingly.
Check the results by running:

```sql
SELECT * FROM experiment_results;

```

in the psql CLI. We can also watch the table changing by exiting the CLI and running a watch command like:

```bash
watch -n1 'psql -U materialize -h localhost -p 6875 materialize -c "SELECT * FROM experiment_results;"'

```

This will execute the select command every second and update the results table as it changes.We've got a real-time materialized view of test results!

## Conclusion

While the resulting view is only a basic join of two Segment event types, the important takeaway is the potential of this setup:

### Joining in more data

1. Any other data that's already sent to Segment can be materialized and used to do more advanced joins, filters queries, all in real-time.
2. Historic or archived data can be ingested from S3 using the Materialize [S3 Source](https://materialize.com/docs/sql/create-source/json-s3/). The same event types can even be UNION'ed between S3 and Kinesis.
3. Data that's **_not_** in Segment can be piped to Kinesis via change data capture tools like Debezium, or soon via the Materialize Postgres Source.

### Layering in more views

* Expand the existing materialized views or layer new views on top that add calculations like conversion rate, p value, significance, and test winner logic. (Or pull those out into an application or BI layer.)
* Orchestrate, test, and document the SQL for sources and views using the [dbt-materialize adapter](https://materialize.com/introducing-dbt-materialize/).

### Thinking about scale

It's also important to consider how this approach completely changes the traditional database considerations of scalability. The main scaling factor in expanding the use of Materialize is: **_how high-cardinality are the keys of the views you want to materialize?_**Other common bottlenecks like **event throughput** (new events per second) will not be a factor for ingesting Segment data: Other Materialize users are comfortably consuming 60k events per second. Additionally, **query demand** (number of users loading the views, frequency at which views are queried) of the output views is not a factor because the work to materialize the results is done when new data comes in, not when a query is made.

### Where we are headed

There is still work to be done on making the output of the view integrate nicely with downstream tools. Materialize presents data via a Postgres API, this means any language-specific Postgres library can connect to Materialize, and soon BI tools like Looker and Tableau should be able to connect easily, but [there are still less-commonly-used `pg_catalog` API calls](https://github.com/MaterializeInc/materialize/issues/2157) that these tools use that are not yet built into Materialize. We have a [fork of open-source BI Tool Metabase](https://hub.docker.com/r/materialize/metabase) that is compatible with Materialize if you'd like to create BI dashboards today. But, to build on the A/B testing example above, we think the real step-change opportunity is in building data products that go beyond existing tools: - Real-time results feedback in the CMS where A/B tests are created - Closed-loop A/B testing systems that automatically integrate winning results - Testing that integrates more deeply with a business's core product. Anyone can [download and install Materialize](https://materialize.com/docs/get-started/) today. It is source-available and free forever in a single node configuration. We also have a [private beta open](https://materialize.com/cloud) of a forthcoming Materialize Cloud product if you'd prefer not to manage it yourself. We look forward to seeing the new generation of innovative data products that engineers build with Materialize, [join us on Slack to discuss ideas!](https://materialize.com/s/chat)