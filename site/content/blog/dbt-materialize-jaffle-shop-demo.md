---
title: "dbt + Materialize demo: Running dbt’s jaffle_shop with Materialize"
category: "Ecosystem"
authors: "jessica"
date: "Wed, 24 Mar 2021 16:19:24 +0000"
description: ""
image: "img/dbt-materialize-jaffle-shop-demo.jpg"
---

## Introduction

We've recently partnered with dbt and community members to [release a beta Materialize dbt adapter](https://materialize.com/introducing-dbt-materialize/) that allows you to transform your streaming data in real time using Materialize as your data warehouse. This tutorial serves as a practical hands-on demonstration of the adapter. In this case, we are using static not streaming data, but the configuration and setup process is the same.

## dbt's jaffle\_shop + Materialize

If you've used dbt, odds are that you've run across dbt's beloved [`jaffle_shop`](https://github.com/fishtown-analytics/jaffle_shop) demo project. `jaffle_shop` allows users to quickly get up and running with dbt, using some spoofed, static data for a fictional [jaffle shop](https://australianfoodtimeline.com.au/jaffle-craze/). At [Materialize](https://materialize.com/), we specialize in maintaining fast and efficient views over your streaming data. While we work on hosting a public source of demo streaming data for analytics, we wanted to provide those familiar with dbt with an easy way to get up and running with our [`dbt-materialize`](https://pypi.org/project/dbt-materialize/) adapter and `jaffle_shop`'s static data.

 Note: This demo won’t highlight what’s powerful about Materialize. For that, check out our [`wikirecent-dbt` demo](https://github.com/MaterializeInc/materialize/blob/main/play/wikirecent-dbt/README.md) or [our docs](https://materialize.com/docs/)!

## Setting up a jaffle\_shop with Materialize

Setting up the `jaffle_shop` project with Materialize is similar to setting it up with any other data warehouse. The following instructions are based off the [traditional `jaffle_shop`](https://github.com/fishtown-analytics/jaffle_shop) steps with a few Materialize-specific modifications:
1. Follow [the first three steps of the `jaffle_shop` instructions](https://github.com/fishtown-analytics/jaffle_shop), install dbt, clone the `jaffle_shop` repository, and navigate to the cloned repo on your machine.
2. In your cloned `dbt_project.yml`, make the following changes to the [model materializations](https://docs.getdbt.com/docs/building-a-dbt-project/building-models/materializations):  
```  
models:  
    jaffle_shop:  
        marts:  
            core:  
                materialized: materializedview  
                intermediate:  
                    materialized: view  
        staging:  
            materialized: view  
            tags: ["staging", "hourly"]  
```  
Tip: Only materializing your `core` business models as materialized views, without materializing your intermediate or staging views, ensures that you're only using the memory you need in Materialize.
Install the [dbt-materialize plugin](https://pypi.org/project/dbt-materialize/). You may wish to do this within a Python virtual environment on your machine:

```bash
python3 -m venv dbt-venv
source dbt-venv/bin/activate
pip install dbt-materialize

```

3. [Install and run Materialize](https://materialize.com/docs/install/). The linked instructions will guide you through running a Materialize instance on your local machine. (Our cloud offering is being developed, [you can register for the private beta here](https://materialize.com/cloud)!)
Create a `jaffle_shop` [dbt profile](https://docs.getdbt.com/dbt-cli/configure-your-profile) that will connect to Materialize. The following profile will connect to a Materialize instance running locally on your machine. The `host` parameter will need to be updated if it's self-hosted in the cloud or run with Docker:

```
jaffle_shop:
    outputs:
        dev:
            type: materialize
            threads: 1
            host: localhost
            port: 6875
            user: materialize
            pass: password
            dbname: materialize
            schema: jaffle_shop

    target: dev

```

If the `profiles.yml` you're using for this project is not located at `~/.dbt/`, you will have to provide [additional information](https://docs.getdbt.com/dbt-cli/configure-your-profile#advanced-profile-configuration) to use the `dbt` commands later on. 
4. Check that your newly created `jaffle_shop` profile can connect to your Materialize instance:  
```bash  
dbt debug  
```
5. Load the static `jaffle_shop` data into Materialize:  
```bash  
dbt seed  
```
6. Run the provided models:  
```bash  
dbt run  
```
7. In a new shell, connect to Materialize to check out the `jaffle_shop` data you just loaded:  
```bash  
# Connect to Materialize  
psql -U materialize -h localhost -p 6875  
```  
```bash  
# See all the newly created views  
materialize=> SHOW VIEWS IN jaffle_shop;  
# Output:  
    name  
-------------------  
customer_orders  
customer_payments  
dim_customers  
fct_orders  
order_payments  
raw_customers  
raw_orders  
raw_payments  
stg_customers  
stg_orders  
stg_payments  
# See only the materialized views  
materialize=> SHOW MATERIALIZED VIEWS IN jaffle_shop;  
# Output:  
    name  
---------------  
dim_customers  
fct_orders  
raw_customers  
raw_orders  
raw_payments  
# Check out data in one of your core models  
materialize=> SELECT * FROM jaffle_shop.dim_customers WHERE customer_id = 1;  
# Output:  
customer_id | first_order | most_recent_order | number_of_orders | customer_lifetime_value  
------------+-------------+-------------------+------------------+-------------------------  
          1 | 2018-01-01  | 2018-02-10        |                2 |                      33  
```  
To see what else you can do with your data in Materialize, [check out our docs](https://materialize.com/docs/).

Test the newly created models:

```bash
dbt test

```

8. Generate and view the documentation for your `jaffle_shop` project:  
```bash  
dbt docs generate  
dbt docs serve  
```

## Conclusion

This walkthrough should leave you with a better understanding of how to integrate Materialize into your existing dbt workflow and start materializing views in true real-time fashion. To get a better understanding of the upstream work necessary for getting your data into Materialize, start with [our docs](https://materialize.com/docs/) and [join us in Slack](https://materialize.com/s/chat) if you have any questions.