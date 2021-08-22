---
title: "How Materialize and other databases optimize SQL subqueries"
category: "Deep-dive"
authors: "Jamie"
date: "Mon, 01 Mar 2021 14:12:46 +0000"
description: ""
image: "img/decorrelation-subquery-optimization.jpg"
---

[Subqueries](https://docs.microsoft.com/en-us/sql/relational-databases/performance/subqueries?view=sql-server-ver15) are a SQL feature that allow writing queries nested inside a scalar expression in an outer query. Using subqueries is often the most natural way to express a given problem, but their use is discouraged because most databases struggle to execute them efficiently. This post gives a rough map of existing approaches to optimizing subqueries and also describes how [Materialize](https://materialize.com) differs from them. It is **NOT** a freestanding or complete explanation - it points to several papers and also assumes background knowledge of SQL and query plans. But it does contain all the things I wish I knew when I started working on this.

## The problem

Let's start with this simple schema:

```sql
create table users (
    id integer primary key, 
    country text
);
create table posts (
    id integer primary key, 
    user_id integer references users(id), 
    content text
);

```

If we wanted to list all posts by users in Narnia we could write it like this:

```sql
select posts.id 
from posts 
where posts.user_id in (
    select users.id 
    from users
    where users.country = 'Narnia'
);

```

In this case `select posts.id from posts where posts.user_id in (...)` is the outer query and `select users.id from users where users.country = 'Narnia'` is the subquery. This is also an **uncorrelated** subquery. That means that the subquery does not use any columns from the outer query. Uncorrelated subqueries are easy to execute because we can only have to run the subquery once. Postgres can handle this easily:

```
 Hash Join  (cost=17.51..50.23 rows=2 width=4)
   Hash Cond: (posts.user_id = users.id)
   ->  Seq Scan on posts  (cost=0.00..28.60 rows=1560 width=8)
   ->  Hash  (cost=17.50..17.50 rows=1 width=4)
         ->  Seq Scan on users  (cost=0.00..17.50 rows=1 width=4)
               Filter: (country = 'Narnia'::text)

```

Here is a **correlated** subquery which counts the number of posts that each user has made:

```sql
select 
  users.id, 
  (
      select count(*)
      from posts 
      where posts.user_id = users.id
  )
from users;

```

It's a correlated subquery because the subquery refers to `users.id` which is a column brought into scope by `from users` in the outer query. The easiest way to execute this is to run the subquery once for each row in the outer query, but this is potentially very inefficient. Databases rely on being able to collect, reorder and batch operations to reduce interpreter overhead and optimize memory access patterns. Running the same query many many times in a nested loop reduces that optimization freedom. Here is how postgres executes this query:

```
 Seq Scan on users  (cost=0.00..25550.00 rows=1000 width=12)
   SubPlan 1
     ->  Aggregate  (cost=25.52..25.54 rows=1 width=8)
           ->  Seq Scan on posts  (cost=0.00..25.50 rows=10 width=0)
                 Filter: (user_id = users.id)

```

See that `SubPlan 1`? That's exactly the nested loop we were worried about. Despite being a conceptually simple query, the plan produced is `O(n^2)` \- "for each user, scan the posts table, filter for matching posts and count". (In this case, building an index on `posts.user_id` would get us to `O(n log(n))` but still with a lot of interpreter overhead compared to the equivalent decorrelated plan below.) What we want to do is **decorrelate** this query - transform it into a query plan which does not contain nested loops. This is also referred to as query flattening or unnesting depending on which database's docs you're reading. Most commercial databases are able to decorrelate some classes of subquery but fall back to nested loops for others.[Materialize](https://materialize.com) compiles SQL queries to a streaming, incremental backend. This backend does not support nested loops as a plan operator so there is no fallback available. It has to be able to decorrelate everything. That turns out to be a challenge.

## Existing approaches

What do other databases do?**Sqlite** has a [list of adhoc rules](https://www.sqlite.org/optoverview.html#subquery_flattening). It's not able to flatten any of the examples in this post - even the first trivial uncorrelated example is planned as a nested loop.**MariaDB (and MySQL)** has a [beautiful diagram of adhoc rules](https://mariadb.com/kb/en/subquery-optimizations-map/). MariaDB is able to flatten our uncorrelated example, but use a nested loop for the correlated example.**PostgreSQL** doesn't appear to have any documentation on subquery optimization. All I could find was [a 10-year old email](https://github.com/postgres/postgres/tree/master/src/backend/optimizer/plan) that was pasted into a readme deep in the planner source code. As we saw above, PostgreSQL can flatten our uncorrelated example but uses a nested loop for the correlated example.**Oracle**, based on their [documented limitations](https://oracle.readthedocs.io/en/latest/sql/subqueries/inline-views-ctes.html) and [this 2009 paper](https://www.researchgate.net/profile/Rafi_Ahmed4/publication/220538535_Enhanced_Subquery_Optimizations_in_Oracle/links/56eaee0808ae9dcdd82a5c93/Enhanced-Subquery-Optimizations-in-Oracle.pdf), seem to perform a very limited form of adhoc decorrelation. Installing Oracle [looks arduous](https://www.nakivo.com/blog/how-to-install-oracle-on-ubuntu-linux-waltkhrough/) so I was lazy and didn't test it.**SQL Server** published papers in [2001](https://www.comp.nus.edu.sg/~cs5226/papers/subqueries-sigmod01.pdf) and [2007](https://www.cse.iitb.ac.in/infolab/Data/Courses/CS632/2014/2009/Papers/subquery-proc-elhemali-sigmod07.pdf) that explain a principled approach to decorrelation by algebraic rewriting. This approach is able to handle most kinds of subqueries, including both of the examples above.**CockroachDB** cites the SQL Server paper in their [decorrelation rules](https://github.com/cockroachdb/cockroach/blob/master/pkg/sql/opt/norm/rules/decorrelate.opt) and they use a similar set of transformation rules as in that paper. Here is how CockroachDB plans the correlated example above:

```
  project
   ├── group-by
   │    ├── left-join (hash)
   │    │    ├── scan users
   │    │    ├── scan posts
   │    │    └── filters
   │    │         └── user_id = users.id
   │    └── aggregations
   │         └── count
   │              └── user_id
   └── projections
        └── count_rows

```

Its able to turn the nested-loop subquery into a join and aggregate, a much more efficient plan. Let's look at how the SQL Server / CockroachDB approach works, since that's the most succesful.

## The algebraic approach

In most databases, SQL queries are converted into a **logical plan** before any optimizations happen. A logical plan looks a lot like [relational algebra](https://en.wikipedia.org/wiki/Relational_algebra), although it's usually extended with some extra operators to handle all the weird corners of the SQL spec. To represent subqueries in the logical plan we need an operator which does something like "for every row in the input, run this subplan and then combine all the results together using some other operator (usually union)". The details vary - in the SQL Server paper this is `Apply`. In CockroachDB it's `apply-join`. In Materialize it never gets explicitly represented, but we have `Exists` and `Select` in the [HIR](https://github.com/MaterializeInc/materialize/blob/main/src/sql/src/plan/expr.rs#L136-L147) which go through a similar set of transformations. Once we have this logical plan, we can try to get rid off the `Apply` by applying peephole optimizations that specify how to move individual operators out of the subplan. You can see a list of these on page 4 of the [2001 SQL Server paper](https://www.comp.nus.edu.sg/~cs5226/papers/subqueries-sigmod01.pdf). They look complicated but deriving them is pretty mechanical. Eventually there are no more correlated variables inside the subplan and we can turn the `Apply` into a `Product`. Here is how that process looks for the correlated example above:

![Apply Step 1](https://materialize.com/wp-content/uploads/2021/02/apply1.svg) 

⬇⬇⬇

![Apply Step 2](https://materialize.com/wp-content/uploads/2021/02/apply2.svg) 

⬇⬇⬇

![Apply Step 3](https://materialize.com/wp-content/uploads/2021/02/apply3.svg) 

⬇⬇⬇

![Apply Step 4](https://materialize.com/wp-content/uploads/2021/02/apply4.svg) 

The main difference between this approach and other more adhoc approaches is that the set of rules provided in the paper cover almost the entire SQL language, except for two problematic categories:**Distinct/Group**. Whan a subquery occurs in the `from` clause and contains a `distinct` or `group by`, we have to remove duplicate rows. But there might also be duplicate rows in the outer query that we should not remove. It's impossible to tell if a duplicate row came from the outer query or the subquery once the two have been joined together. Here is a (slightly contrived) query that stresses this:

```sql
select
  users.id, count
  from users,
  lateral (
      select count(distinct posts.content)
      from posts
      where posts.user_id = users.id
  );

```

CockroachDB is not able to decorrelate this query unless we remove the `distinct`:

```
  group-by
   ├── left-join-apply
   │    ├── scan users
   │    ├── distinct-on
   │    │    └── select
   │    │         ├── scan posts
   │    │         └── filters
   │    │              └── user_id = users.id
   │    └── filters (true)
   └── aggregations
        └── count
             └── content

```

But SQL Server is smart enough to perform the count before joining against `users`;

```
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  |--Compute Scalar(DEFINE:([Expr1004]=CASE WHEN [Expr1004] IS NULL THEN (0) ELSE [Expr1004] END))                                                                           
       |--Merge Join(Right Outer Join, MERGE:([master].[dbo].[posts].[user_id])=([master].[dbo].[users].[id]), RESIDUAL:([master].[dbo].[posts].[user_id]=[master].[dbo].[users].[id]))
            |--Compute Scalar(DEFINE:([Expr1004]=CONVERT_IMPLICIT(int,[Expr1007],0)))                                                                                        
            |    |--Stream Aggregate(GROUP BY:([master].[dbo].[posts].[user_id]) DEFINE:([Expr1007]=COUNT([master].[dbo].[posts].[content])))                                
            |         |--Sort(DISTINCT ORDER BY:([master].[dbo].[posts].[user_id] ASC, [master].[dbo].[posts].[content] ASC))                                                
            |              |--Clustered Index Scan(OBJECT:([master].[dbo].[posts].[PK__posts__3213E83F27B5AB95]))                                                            
            |--Clustered Index Scan(OBJECT:([master].[dbo].[users].[PK__users__3213E83FCD4715F6]), ORDERED FORWARD) 

```

**Max1**. When a subquery occurs in the `select` clause, it must return at most one row, otherwise the query is aborted with an error. If we decorrelate the subquery then there is no place in the resulting plan where we can insert the `Max1` operator to check the results - if we find two rows with the same variables from the outer it might be because the subquery produced multiple rows for a single outer row or because the outer query already had multiple copies of that outer row. (This logic is necessary to deal with cases where there are multiple relations appearing in a scalar expression. There are three reasonable ways that this could have been specced - allow at most one row in each relation, take the product of the relations, or order the relations and pair them up row-wise. Never one for consistency, SQL chose all three options - in select-subqueries, lateral joins and table-valued functions respectively.) In the first correlated example above with `count(*)` we know that `count` always returns a single row, so this isn't a problem. But if we just select `posts.id` then there might be multiple results:

```sql
select 
  users.id, 
  (
      select posts.id
      from posts 
      where posts.user_id = users.id
  )
from users;

```

SQL Server is stuck with `Nested Loops` on this query:

```
------------------------------------------------------------------------------------------------------------------
  |--Compute Scalar(DEFINE:([Expr1005]=[Expr1007]))
       |--Nested Loops(Left Outer Join, OUTER REFERENCES:([master].[dbo].[users].[id]))
            |--Clustered Index Scan(OBJECT:([master].[dbo].[users].[PK__users__3213E83FCD4715F6]))
            |--Assert(WHERE:(CASE WHEN [Expr1006]>(1) THEN (0) ELSE NULL END))
                 |--Stream Aggregate(DEFINE:([Expr1006]=Count(*), [Expr1007]=ANY([master].[dbo].[posts].[id])))
                      |--Index Spool(SEEK:([master].[dbo].[posts].[user_id]=[master].[dbo].[users].[id]))
                           |--Clustered Index Scan(OBJECT:([master].[dbo].[posts].[PK__posts__3213E83F27B5AB95]))


```

But CockroachDB manages to decorrelate it:

```
  project
   ├── ensure-distinct-on
   │    ├── left-join (hash)
   │    │    ├── scan users
   │    │    ├── scan posts
   │    │    └── filters
   │    │         └── user_id = users.id
   │    └── aggregations
   │         └── const-agg
   │              └── posts.id
   └── projections
        └── posts.id

```

CockroachDB is using a hidden row-id column to detect which side of the join any duplicate rows came from. In more complex queries it will add an `ordinal` operator to synthesize new unique ids. It's a neat solution, but unfortunately it's difficult to combine this with streaming incremental view maintenance - any change to the input might require updating the ids of all of the output.

## Closing the gaps

The incremental, streaming backend for Materialize is not able to execute the `Apply` operator directly, so it must always be removed by optimizations. At the time I thought our approach was original but I later found [this 2015 paper](https://dl.gi.de/bitstream/handle/20.500.12116/2418/383.pdf?sequence=1) by Neumann and Kemper which details an almost identical solution. (Their database engine was later [sold to Tableau](https://www.tableau.com/products/new-features/hyper) so, hilariously, Tableau might currently have the best decorrelation ability of any production database engine.) The key insight is that in both the problematic categories above the underlying problem is that information about row counts in the input to `Apply` is lost during decorrelation. The obvious solution to this is to keep the original input around. Unfortunately, almost all existing databases require query plans to be trees. This means that the only way to keep a copy of the input is to duplicate that entire branch of the plan. This can be prohibitively expensive, especially when you consider that subqueries can be nested arbitrarily deep and the amount of duplication could be exponential with respect to the nesting depth. Materialize allows plans to be directed acyclic graphs. We can decorrelate both of the problematic cases by running the decorrelated subquery on only the unique rows of the input and then joining the output against the original input to recover the original row counts.

![MZ Plan 1](https://materialize.com/wp-content/uploads/2021/02/mz1.svg)

Here is the plan materialize produces for the `count(distinct ...)` example above (which CockroachDB could not decorrelate) with comments (`//`) added by hand:

![MZ Plan 2](https://materialize.com/wp-content/uploads/2021/02/mz2.svg)

```
// Request an index on distinct values of `users.id`
 %0 =                                        
 | Get jamie.public.users (u3)               
 | Distinct group=(#0)                                                               
 %1 =                                        
 | Get %0                                    
 | ArrangeBy (#0)                            

// Filter out null `posts.user_id`
// (Materialize doesn't understand foreign constraints yet)
 %2 =                                        
 | Get jamie.public.posts (u5)               
 | Filter !(isnull(#1))                      

// Join %1 and %2 on `users.id = posts.user_id`
// Group by `users.id` and count distinct `posts.content`
 %3 =                                        
 | Join %1 %2 (= #0 #2)                      
 | | implementation = Differential %2 %1.(#0)
 | | demand = (#0, #3)                       
 | Filter !(isnull(#0))                      
 | Reduce group=(#0)                         
 | | agg count(distinct #3)                  

// Request an index on `users.id` 
// (Materialize doesn't understand unique keys yet, so doesn't realize this index is redundant)
 %4 =                                        
 | Get jamie.public.users (u3)               
 | ArrangeBy (#0)                            

// Find values of `users.id` for which there are no posts and assign count 0
 %5 =                                        
 | Get %3                                    
 | Negate                                    
 | Project (#0)                                                                    
 %6 =                                        
 | Union %5 %0                               
 | Map 0                                     

// Union the zero counts and the non-zero counts 
 %7 =                                        
 | Union %3 %6                               

// Join the results against `users` to recover row counts that were erased by the group-by above
// (Materialize doesn't understand unique keys yet, so doesn't realize this join is redundant)
 %8 =                                        
 | Join %4 %7 (= #0 #2)                      
 | | implementation = Differential %7 %4.(#0)
 | | demand = (#0, #3)                       
 | Project (#0, #3)                          

```

(Check out the [EXPLAIN docs](https://materialize.com/docs/sql/explain/#reading-decorrelatedoptimized-plans) to learn how to read these plans. Much of the apparent complexity of the plan is because relational operations like `left join` have been reduced to combinations of smaller [differential dataflow](https://github.com/TimelyDataflow/differential-dataflow/) operations like `negate`.) The Max1 example also decorrelates in Materialize, but [actually reporting the errors](https://github.com/MaterializeInc/materialize/issues/5219#issuecomment-763373621) is blocked on the more general design problem of [how to respond to query errors](https://github.com/MaterializeInc/materialize/issues/489) in a long-lived streaming system. EDIT: this has been fixed in [#5651](https://github.com/MaterializeInc/materialize/pull/5651).

## Future work

The method above allows Materialize to decorrelate almost any subquery. The only hard limitation I'm aware of at present is that decorrelating recursive CTEs inside subqueries hasn't been implemented. It seems simple in theory, but will likely require a lot of fiddly context tracking to be threaded through the decorrelation logic. Much more pressing is the quality of the generated plans. The current planner often struggles to optimize plans where some node is used in multiple places. The worst case is when the plan contains a cross product and an equality filter which, if combined, would produce a join. But the planner can't push the filter through the decorrelated subquery and so the [cross product remains](https://github.com/MaterializeInc/materialize/issues/2068) in the final plan. In the near term, I think most of these problems can be solved by [moving decorrelation into the optimizer](https://github.com/MaterializeInc/materialize/issues/2934) rather than having it as a separate pass before optimization. This would allow other optimizations to happen while the plan is still a tree, and would also allow adding many additional decorrelation rules for cases which have simpler solutions. But in the long term, I think it's also worth figuring out how to do plan optimization on graphs. Aside from decorrelation, it also comes up when using CTEs or chains of views. Most databases handles this by making CTEs and views optimization fences, meaning that each is optimized individually but eg filters can't be pushed down into views. This really limits their usefulness. I'm not aware of much existing work on this problem and most of what I have seen is in the context of datalog which has far fewer tricky corners.**_Thanks to Justin Jaffray for corrections._**This article was originally published in Jamie Brandon's [research newsletter](https://scattered-thoughts.net) here: [How Materialize and other databases optimize SQL subqueries](https://scattered-thoughts.net/writing/materialize-decorrelation)