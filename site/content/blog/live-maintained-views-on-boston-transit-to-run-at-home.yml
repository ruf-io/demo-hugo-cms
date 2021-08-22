---
title: "Live Maintained Views on Boston Transit to Run at Home"
category: "Use Case"
authors: "andi"
date: "Wed, 02 Dec 2020 15:01:08 +0000"
description: ""
slug: "live-maintained-views-on-boston-transit-to-run-at-home"
---

Materialize can be used to quickly build scalable backends for real-time apps! In this blog post, we describe two apps that you can try out at home that run on actual, live data!When I joined Materialize, I moved to New York City after having lived most of my life in the Boston area, and it was definitely an adjustment to see people everywhere wearing Yankees hats. And then COVID-19 happened, and now it’s even more of an adjustment. Without Broadway shows and such to distract me, I've actually started to miss my hometown. So, I decided to play around and see what kind of live views of Boston I could construct using Materialize. Using data from the Massachusetts Bay Transportation Authority (MBTA), which operates most of the public transit services in the Boston metro area, I ended up with views that could support two apps:
1. A countdown clock for the next vehicles to arrive at a station.
2. A travel time prediction app.
With the instructions below, you, too, can play along at home. (Not that you can play along anywhere else these days.)

## Setup

### Overview

The MBTA has a great collection of live JSON API data streams that allow you to observe the entire system live. To access the streams, request an API key at <https://api-v3.mbta.com/>. Then clone the Materialize GitHub repo from <https://github.com/MaterializeInc/materialize.git>. This blog post assumes that:
* You run terminal commands from [\[<materialize\_root\_folder/play/mbta>\]](https://github.com/MaterializeInc/materialize/tree/main/play/mbta).
* You have Docker installed and properly configured to run with at least 2 CPUs and 8 GB of memory. If you need help on this, consult our [guide on using Docker](https://materialize.io/docs/third-party/docker/#main).
* In addition to having sufficient disk space for the Docker images, you have sufficient disk space for the live data being downloaded, which is approximately 500 MB-800MB per hour, depending on the time of day.
* You have `psql` installed.
* You are downloading the streams when the MBTA routes are actually running. At the time of writing, most MBTA routes run from 5 AM to 1 AM Boston local time (UTC-4 or UTC-5 depending on the season). If you get blank streams, check [the MBTA schedule](https://www.mbta.com/schedules).
More detailed instructions can be found at [\[<materialize\_root\_folder/play/mbta/doc/mbta-setup.md>\]](https://github.com/MaterializeInc/materialize/blob/main/play/mbta/doc/mbta-setup.md) if you prefer to setup Materialize with alternate configurations. There will be brief videos of the apps later on in this post for those of you who just want to skip straight to seeing them in action.

### Getting started

[The MBTA predictions stream, among others, requires that you filter by route, stop, or trip in order to get any results.](https://api-v3.mbta.com/docs/swagger/index.html#/Prediction) To save you effort, I have written code that way you can stream in all the predictions for all subway routes and all 15 key bus routes [(map here)](https://cdn.mbta.com/sites/default/files/2020-05/subway-map-june2020-v34a-GLX-shuttle.pdf) at once and push the data into a single key-value Kafka topic. Run from your terminal window:

```bash
API_KEY=<YOUR_API_KEY_HERE> ../../bin/mzconduct run mbta -w start-live-data

```

This automatically:
1. Turns on a Materialize instance.
2. Downloads the metadata associated with the MBTA streams (<https://www.mbta.com/developers/gtfs>).
3. For each MBTA stream, does a `curl` command to create a connection to it and write its contents out to a file.
4. Runs code that tails each file, parses each JSON object received into key and value, and inserts the key and value into a Kafka topic

### Exploring the MBTA streams in Materialize

Turn on `psql` and connect it to the materialize instance that is now running. (For help, check out [https://materialize.com/docs/connect/cli/#psql-example](https://materialize.io/docs/connect/cli/#psql-example).) Let’s load the live arrival and departure predictions topic into Materialize and see how it looks like.

```sql
CREATE MATERIALIZED SOURCE all_pred
FROM KAFKA BROKER 'kafka:9092' TOPIC 'all-pred'
  FORMAT TEXT ENVELOPE UPSERT;

```

(See our [earlier blog post](https://materialize.com/upserts-in-differential-dataflow/) for more details about our support for upserts.) Try

```sql
select * from all_pred limit 1;

```

If the result is blank, or you get a "no complete timestamps yet" error, then you've tried too fast. Wait a couple of minutes until the stream finishes loading, and try again. With expanded display turned on (`\x`), the result looks something like this:

```
-[ RECORD 1 ]------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
key0      | prediction-45683933-6-4
text      | {"attributes":{"arrival_time":"2020-11-17T18:39:27-05:00","departure_time":"2020-11-17T18:39:27-05:00","direction_id":0,"schedule_relationship":null,"status":null,"stop_sequence":4},"relationships":{"route":{"data":{"id":"1","type":"route"}},"stop":{"data":{"id":"6","type":"stop"}},"trip":{"data":{"id":"45683933","type":"trip"}},"vehicle":{"data":{"id":"y1878","type":"vehicle"}}}}
mz_offset | 609179

```

For the rows in the stream to actually be useful, though, we need to do two things: **_1\. Parse the JSON string into columns._** 

```sql
CREATE VIEW parsed_all_pred as
SELECT pred_id,
  CAST(payload->'attributes'->>'arrival_time' AS timestamptz) arrival_time,
  CAST(payload->'attributes'->>'departure_time' AS timestamptz) departure_time,
  CAST(CAST(payload->'attributes'->>'direction_id' AS DECIMAL(5,1)) AS INT) direction_id,
  payload->'attributes'->>'schedule_relationship' schedule_relationship,
  payload->'attributes'->>'status' status,
  CAST(CAST(payload->'attributes'->>'stop_sequence' AS DECIMAL(5,1)) AS INT) stop_sequence,
  payload->'relationships'->'route'->'data'->>'id' route_id,
  payload->'relationships'->'stop'->'data'->>'id' stop_id,
  payload->'relationships'->'trip'->'data'->>'id' trip_id,
  payload->'relationships'->'vehicle'->'data'->>'id' vehicle_id
FROM (SELECT key0 as pred_id, cast (text as jsonb) AS payload FROM all_pred);

```

 **_2\. Enrich the data so we know what the stop, route, and direction names are._** The downloaded metadata has stop, route, and direction names as part of CSV files. Load the CSV files into Materialize.

```sql
CREATE MATERIALIZED SOURCE mbta_directions
FROM FILE '/workdir/workspace/MBTA_GTFS/directions.txt'
  FORMAT CSV WITH HEADER;

CREATE MATERIALIZED SOURCE mbta_stops
FROM FILE '/workdir/workspace/MBTA_GTFS/stops.txt'
  FORMAT CSV WITH HEADER;

CREATE MATERIALIZED SOURCE mbta_routes
FROM FILE '/workdir/workspace/MBTA_GTFS/routes.txt'
  FORMAT CSV WITH HEADER;

```

Materialize automatically parses the columns in the CSV files, so the sources can be directly joined to our parsed view.

```sql
CREATE MATERIALIZED VIEW enriched_all_pred AS
SELECT pred_id, arrival_time, departure_time, direction, p.route_id,
  CASE WHEN route_desc LIKE '%Bus'
    THEN route_short_name
    ELSE route_long_name
    END AS route_name,
  schedule_relationship, status, stop_sequence,
  p.stop_id, stop_name, trip_id, vehicle_id
FROM parsed_all_pred p, mbta_routes r, mbta_stops s, mbta_directions d
WHERE p.stop_id = s.stop_id
  AND p.route_id = r.route_id
  AND p.route_id = d.route_id
  AND p.direction_id = CAST(d.direction_id AS INT);

```

Now we can explore the stream. Let’s check out the upcoming southbound Red Line trains in order of predicted departure from Kendall/MIT.

```sql
CREATE TEMPORARY VIEW south_from_kendall AS
SELECT *
FROM enriched_all_pred
WHERE stop_name = 'Kendall/MIT'
  AND direction = 'South'
  AND route_name = 'Red Line';

SELECT * FROM south_from_kendall ORDER BY departure_time;

```

You will see the next southbound subway trains due to depart from Kendall/MIT within the next hour, and the records will look something like this:

```
-[ RECORD 1 ]---------+-------------------------------------
pred_id               | prediction-45295407-70071-50
arrival_time          | 2020-11-17 23:30:26+00
departure_time        | 2020-11-17 23:31:18+00
direction             | South
route_id              | Red
route_name            | Red Line
schedule_relationship |
status                |
stop_sequence         | 50
stop_id               | 70071
stop_name             | Kendall/MIT
trip_id               | 45295407
vehicle_id            | R-5467ABFC

```

(Currently, Materialize only supports displaying UTC times. If you want to see the data in your local time zone, you can add or subtract the time difference. See <https://materialize.io/docs/sql/types/timestamp/#valid-operations>.) Take note of the `pred_id` and `departure_time` of the first record. If you re-run the SELECT query after the departure time, you will see that the record corresponding to that `pred_id` will have disappeared. Try `COPY (TAIL south_from_kendall) TO STDOUT;` and observe it for a while. You will see that Materialize will automatically update the view whenever the MBTA stream issues an update to the expected arrival or departure time for a train. Here's a video of everything we've done up to this point: \[video width="1280" height="696" mp4="https://materialize.com/wp-content/uploads/2020/11/MBTA-demo-setup.mp4"\]\[/video\]

## Countdown Clock App

Now that we have dipped our toes a bit, it’s time to try making an app. If you actually go to the southbound track at Kendall/MIT, you wouldn’t see the next trains listed in a table that looks like `south_from_kendall`. Instead, you will see a countdown clock that looks like [this](https://twitter.com/MBTA/status/1034241739635281921?s=20). The MBTA has written down the exact specification for the countdown clock [here](https://www.mbta.com/developers/v3-api/best-practices) (See “Displaying Predictions”->”Display Rules”). Let's make the official countdown clock in Materialize. Beyond what we already have in the view `enriched_all_pred`, we still need three more pieces of information: **_1\. The final destination of the trip associated with the prediction. This is known as the "headsign."_**For your convenience, the setup code also downloads the trip status stream for all routes for which it downloads predictions streams, and it has put the trip data into a topic called `all-trip`.

```sql
CREATE SOURCE all_trip
FROM KAFKA BROKER 'kafka:9092' TOPIC 'all-trip'
  FORMAT TEXT ENVELOPE UPSERT;

CREATE MATERIALIZED VIEW parsed_all_trip as
SELECT trip_id,
  payload->'attributes'->>'bikes_allowed' bikes_allowed,
  CAST(CAST(payload->'attributes'->>'direction_id' AS DECIMAL(5,1)) AS INT) direction_id,
  payload->'attributes'->>'headsign' headsign,
  payload->'attributes'->>'wheelchair_accessible' wheelchair_accessible,
  payload->'relationships'->'route'->'data'->>'id' route_id,
  payload->'relationships'->'route_pattern'->'data'->>'id' route_pattern_id,
  payload->'relationships'->'service'->'data'->>'id' service_id,
  payload->'relationships'->'shape'->'data'->>'id' shape_id
FROM (SELECT key0 as trip_id, cast ("text" as jsonb) AS payload FROM all_trip);

```

 **_2\. The status of the vehicle associated with the prediction._** Likewise, the setup code has already created a connection to the stream containing the status of all MBTA vehicles and put the data into a topic called `all-vehicles`.

```sql
CREATE SOURCE all_vehicles
FROM KAFKA BROKER 'kafka:9092' TOPIC 'all-vehicles'
  FORMAT TEXT ENVELOPE UPSERT;

CREATE MATERIALIZED VIEW parsed_all_vehicles as
SELECT vehicle_id,
  payload->'attributes'->>'current_status' status,
  CAST(CAST(payload->'attributes'->>'direction_id' AS DECIMAL(5,1)) AS INT) direction_id,
  payload->'relationships'->'route'->'data'->>'id' route_id,
  payload->'relationships'->'stop'->'data'->>'id' stop_id,
  payload->'relationships'->'trip'->'data'->>'id' trip_id
FROM (SELECT key0 as vehicle_id, cast ("text" as jsonb) AS payload FROM all_vehicles);

```

 **_3\. The current time._** The setup code has set up a thread that prints the current Unix timestamp every second to a file. We can tail the file in Materialize and convert the epoch time to a `timestamptz` column.

```sql
CREATE SOURCE current_time
FROM FILE '/workdir/workspace/current_time' WITH(tail=true) FORMAT TEXT;

CREATE MATERIALIZED VIEW current_time_v AS
SELECT max(to_timestamp(cast(text as int))) AS now
FROM current_time;

```

Now we can join all these pieces together and calculate how many seconds away a vehicle is from the stop.

```sql
CREATE VIEW countdown_inner AS
SELECT
  p.status as pred_status,
  EXTRACT (EPOCH FROM
    COALESCE(arrival_time, departure_time) - current_time_v.now
  ) seconds_away,
  departure_time,
  headsign,
  v.status as vehicle_status,
  p.stop_id as pred_stop_id,
  v.stop_id as vehicle_stop_id,
  p.stop_name as stop_name,
  p.direction as direction,
  p.route_name as route_name
FROM enriched_all_pred p
INNER JOIN parsed_all_trip t on p.trip_id = t.trip_id
INNER JOIN parsed_all_vehicles v on v.vehicle_id = p.vehicle_id
CROSS JOIN current_time_v;

```

Then, we can apply the countdown clock display rules.

```sql
CREATE MATERIALIZED VIEW countdown AS
SELECT
  headsign,
  pred_status as status,
  seconds_away,
  stop_name,
  direction,
  route_name
FROM countdown_inner
WHERE pred_status IS NOT NULL
UNION ALL
SELECT
  headsign,
  CASE WHEN vehicle_status = 'STOPPED_AT'
    AND pred_stop_id = vehicle_stop_id
    AND seconds_away <= 90
  THEN 'Boarding'
  ELSE
    CASE WHEN seconds_away <= 30 THEN 'Arriving' ELSE
      CASE WHEN seconds_away <= 60 THEN 'Approaching' ELSE
        CASE WHEN seconds_away <=89 THEN '1 minute' ELSE
          CASE WHEN seconds_away >=1230 THEN '20+ minutes' ELSE
            round(CAST(seconds_away AS FLOAT)/60) || ' minutes'
          END
        END
      END
    END
  END status,
  seconds_away,
  stop_name,
  direction,
  route_name
FROM countdown_inner
WHERE pred_status IS NULL
  AND departure_time IS NOT NULL
  AND seconds_away >= 0;

```

You now have the backend for a countdown clock app that gives you the countdown clock for any subway or key bus station. To get the countdown clock for any particular combination of stop, direction, and route, an app client would create a view like the one below. Using [`TAIL`](https://materialize.com/docs/sql/tail) would allow the app client will receive an update whenever the countdown clock updates.

```sql
CREATE TEMPORARY VIEW south_from_kendall_countdown AS
SELECT headsign, status
FROM countdown
WHERE stop_name = 'Kendall/MIT'
  AND direction = 'South'
  AND route_name = 'Red Line'
ORDER BY seconds_away LIMIT 2;

```

## An Aside - App Performance Optimization

By now, you have seen three different kinds of view creation commands:
* `CREATE VIEW`
* `CREATE MATERIALIZED VIEW`
* `CREATE TEMPORARY VIEW`
What do each of these view creation commands mean? In which situations should you use one over the others? The way Materialize works is that as your data streams through, Materialize will store in memory and maintain in real-time the information that required to answer the questions you care about. When you construct SQL views for your app, ideally, you want to do it in a way that Materialize maintains just what you need and maintains as few copies of it as possible. Materialize stores your data in indexes. Indexes can be associated with either a view or a source.
* `CREATE VIEW` and `CREATE TEMPORARY VIEW` create views with no indexes.
* `CREATE MATERIALIZED VIEW view_name AS ...` is a shorthand for  
CREATE VIEW view_name AS ...;  
CREATE DEFAULT INDEX ON view_name;
My colleague Jessica has a more detailed explainer in [this prior blog post](https://materialize.com/why-use-a-materialized-view/), but roughly speaking, adding an index to a view improves the speed of querying from the view, but the cost is that:
1. It takes up memory to store and maintain the index.
2. It takes a bit of time to initialize the index, during which the view is not queryable. This is why you may get the "no complete timestamps yet" if you query a materialize source or view right after creating it.
It follows that:
* We create views like `countdown_inner` and `parsed_all_pred` without indexes because we don't want to use up memory on intermediate views that we don't intend to query.
* We create `countdown` with an index because this is the information that we want to serve to clients quickly.
* The app client creates views without indexes to avoid copying information that is already in `countdown` and avoid the startup delay involved in initializing an index. The views are temporary that way the view definitions are automatically cleaned up when the user session ends.
Indexes in Materialize can built on top of each other. As you will see, the view is `enriched_all_pred` used for both apps in this blog post, so it has been created with an index because it saves memory and processing power to compute the information only once. Technically, the materialized source `all_pred` also contains intermediate results neither app will query, but we originally materialized that source for the purpose of being able to query it and see what the records look like. If you query a view with no index, Materialize will search through the views and sources it depends on to find the closest available indexes to base its calculations off of. Materialize would return an error if it cannot find an index to build an answer off of. While we would make `all_pred` not materialized when running the app in production, we can skip it for this at-home exercise. This is because the index on `enriched_all_pred` has already been built on top of the index on `all_pred`, and we don't support reindexing yet, so freeing the memory for the index on `all_pred` would require tearing a bunch of things down and rebuilding. However, at this point, we can tear down the index on `countdown` and make a new one that will serve client queries even faster. Run

```sql
SHOW INDEX IN countdown;

```

The result should look like this:

```
on_name    | key_name              | seq_in_index | column_name  | expression | nullable
-----------+-----------------------+--------------+--------------+------------+----------
countdown  | countdown_primary_idx | 1            | headsign     |            | t
countdown  | countdown_primary_idx | 2            | status       |            | t
countdown  | countdown_primary_idx | 3            | seconds_away |            | t
countdown  | countdown_primary_idx | 4            | stop_name    |            | f
countdown  | countdown_primary_idx | 5            | direction    |            | f
countdown  | countdown_primary_idx | 6            | route_name   |            | f

```

This tells us `countdown` has an index called `countdown_primary_idx`, and the index includes all columns in `countdown`. Because the app client will always be filtering by `stop_name`, `direction`, and `route_name`, if we had an index on just those three columns, the queries will return much faster. The commands for reindexing are below. Turn on `\timing` in `psql`, create a temporary view like `south_from_kendall_countdown`, and select everything from the view several times before and after the reindexing. You should see a several-fold improvement in query speed.

```sql
DROP INDEX countdown_primary_idx;

CREATE INDEX countdown_stop_dir_rt ON countdown(stop_name, direction, route_name);

```

A video of the optimized Countdown Clock App is below. Note: about a minute and a half of waiting for index startup to complete has been trimmed from the middle of the video. \[video width="1280" height="720" mp4="https://materialize.com/wp-content/uploads/2020/11/MBTA-countdown-clock-app-2.mp4"\]\[/video\]

## Building a Travel Time Prediction App

We can do better than simulate watching trains come in and out of the station. As long as the origin and destination are on the same line, we can calculate when we would arrive at a destination based on we leave the origin by doing a self-join on `enriched_all_pred`. To display timestamps in the Boston local time (UTC-5) at time of writing, we subtract 5 hours. During daylight savings time, subtract 4 hours.

```sql
CREATE VIEW one_leg_travel_time AS
SELECT
  p1.stop_name as origin,
  p2.stop_name as destination,
  p1.route_name,
  CAST(p1.departure_time - INTERVAL '5' HOURS as timestamp) as departure_time,
  CAST(p2.arrival_time - INTERVAL '5' HOURS as timestamp) as arrival_time,
  t.headsign
FROM enriched_all_pred p1, enriched_all_pred p2, parsed_all_trip t
WHERE p1.trip_id = p2.trip_id
  AND t.trip_id = p1.trip_id
  AND p1.stop_sequence < p2.stop_sequence;

CREATE INDEX one_leg_stops ON one_leg_travel_time(origin, destination);

SELECT departure_time, arrival_time, headsign
FROM one_leg_travel_time
WHERE origin = 'Kendall/MIT' and destination = 'South Station'
ORDER BY arrival_time;

```

(The MBTA predictions stream API says if Stop A in a trip has a lower `stop_sequence` number than Stop B, then the vehicle will stop at Stop A first and Stop B second.) A naive way to get travel time predictions when the trip requires a single transfer would be to do a self-join on `one_leg_travel_time`. But it turns out that the number of pairs of MBTA stops that are connected with a single transfer is so large that you would quickly run out of memory if you are running this at home with 8 GB of memory. But we can still use Materialize to maintain much of the heavy lifting required to predict travel times for trips involving a transfer. We just have to take advantage of the the fact that the number of points in the system where you can transfer is far fewer than the number of pairs of stops in the system. Amongst the metadata, there is a CSV file that lists transfers you can do within the system, complete with estimated transfer times.

```sql
CREATE SOURCE mbta_transfers
FROM FILE '/workdir/workspace/MBTA_GTFS/transfers.txt'
FORMAT CSV WITH HEADER;

```

Using the list of transfers stops, you can create a materialized view that maintains, for each trip entering a transfer station, all trips exiting the same transfer station that you have the time to transfer to.

```sql
CREATE MATERIALIZED VIEW valid_transfers AS
SELECT
  p1.trip_id as leg1_trip_id,
  p2.trip_id as leg2_trip_id,
  p1.stop_sequence as leg1_dest_stop_sequence,
  p2.stop_sequence as leg2_orig_stop_sequence,
  p2.stop_name as change_at,
  p1.route_name as leg1_route,
  p2.route_name as leg2_route,
  t1.headsign as leg1_headsign,
  t2.headsign as leg2_headsign
FROM enriched_all_pred p1, enriched_all_pred p2, mbta_transfers tr,
  parsed_all_trip t1, parsed_all_trip t2
WHERE p1.stop_id = tr.from_stop_id
  AND p2.stop_id = tr.to_stop_id
  AND t1.trip_id = p1.trip_id
  AND t2.trip_id = p2.trip_id
  AND p1.route_name != p2.route_name
  AND (p2.departure_time - p1.arrival_time) >
    concat(tr.min_transfer_time, ' second')::interval;

```

Your app client would issue a query joining to `valid_transfers` the list of trips departing from your origin station and the list of the trips arriving at your destination.

```sql
CREATE TEMPORARY VIEW kendall_to_north AS
SELECT
  CAST(p1.departure_time - INTERVAL '5' HOURS as timestamp) as departure_time,
  CAST(p2.arrival_time - INTERVAL '5' HOURS as timestamp) as arrival_time,
  vt.leg1_route,
  vt.leg1_headsign,
  vt.change_at,
  vt.leg2_route,
  vt.leg2_headsign
FROM
  valid_transfers vt,
  enriched_all_pred p1,
  enriched_all_pred p2
WHERE p1.trip_id = vt.leg1_trip_id
  AND p2.trip_id = vt.leg2_trip_id
  AND p1.stop_sequence < vt.leg1_dest_stop_sequence
  AND vt.leg2_orig_stop_sequence < p2.stop_sequence
  AND p1.stop_name='Kendall/MIT'
  AND p2.stop_name='North Station';

```

If you select everything from `kendall_to_north`, you will get every valid combination of trips from Kendall/MIT to North Station. Normally, if you were using a travel time prediction app, you'd only want to know about the earliest trip you can take leaving a transfer station. Also, if multiple combinations of trips involve you arriving at the station at the same time, you'd only want to know about the trip that departs the latest. To filter `kendall_to_north` to only trips you'd care about, the client would then select from the temporary view using [lateral joins](https://materialize.com/docs/sql/join/#lateral-subqueries):

```sql
SELECT
  lat.*
FROM
  (SELECT DISTINCT departure_time FROM kendall_to_north) ktn1,
  LATERAL(
    SELECT inner_lat.*
    FROM
      (SELECT DISTINCT arrival_time FROM kendall_to_north) ktn2 ,
      LATERAL(
        SELECT *
        FROM kendall_to_north ktn3
        WHERE ktn3.arrival_time=ktn2.arrival_time
        ORDER BY departure_time DESC LIMIT 1) inner_lat
    WHERE ktn1.departure_time = inner_lat.departure_time
    ORDER BY arrival_time LIMIT 1
  ) lat
ORDER BY arrival_time;

```

You can compare the results of the query with Google Maps if you like. A video of the Travel Time Prediction App is below. Like with the Countdown Clock App, a minute of waiting for the index to initialize was trimmed from the middle of the video. \[video width="1280" height="584" mp4="https://materialize.com/wp-content/uploads/2020/11/MBTA-travel-prediction-app.mp4"\]\[/video\]

## Conclusion

The Countdown Clock and Travel Time Prediction Apps are just a small taste of the real-time apps that you can create with Materialize. Try creating an app on your own! If you want some ideas, here are some facets exposed in the MBTA streams that I'm interested in exploring when I have the time:
* A few months ago, in light of the pandemic, the vehicles stream added [a new field](https://groups.google.com/g/massdotdevelopers/c/pAhafJkLFBY) giving updates on [how crowded buses are](https://www.mbta.com/projects/crowding-information-riders).
* Comparing the contents of the schedule streams to the predictions streams should give a live view of how on-time vehicles are.
Check out the [play/mbta](https://github.com/MaterializeInc/materialize/tree/main/play/mbta) directory for details on how to load your own set of streams. We are actively working on developing new features that will make Materialize easier to use and better performing. I'm personally very excited about improvements to [sinks](https://materialize.com/docs/overview/api-components/#sinks) that are coming down the tube because Materialize will then be able to convert the contents of the MBTA streams to Kafka topics by itself, and much of the setup code will become unnecessary. To be informed of new features, subscribe to this newsletter and/or [join our community slack!](https://materializecommunity.slack.com/join/shared_invite/zt-jjwe1t45-klG9k7V7xibdtqA6bcFpyQ#)If you have made any apps with Materialize, we’d love to hear about it! Besides our community Slack, you can also reach out to us via [Github](https://github.com/MaterializeInc) and [Twitter](https://twitter.com/materializeinc).