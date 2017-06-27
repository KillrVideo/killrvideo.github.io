# Using DataStax Studio

## About DataStax Studio

[DataStax Studio][studio] is an interactive tool for querying, exploring, analyzing, and visualizing data in CQL and Graph 
(Gremlin) formats. 

- For CQL, it provides the ability to visually create and navigate database objects, create complex queries, and tune 
CQL queries. Studio includes an intelligent CQL editor that provides syntax highlighting, validation, intelligent code 
completion, configuration options, and query profiling.
- For DSE Graph, it allows you to explore and view large datasets. It provides an intuitive interface for developers 
and analysts to collaborate and test theories by mixing code, documentation, and visualizations for query results and 
profiles into self-documenting notebooks. The code is written in the Gremlin graph traversal language.
- Notebooks combine runnable Gremlin and CQL code and markdown text in a rich interactive environment. 
[Markdown][markdown] is a simple language for creating human-readable plain text documents that can be displayed.

## Accessing the KillrVideo Examples
The docker-compose scripts that come with the language installations of KillrVideo
are configured to start the DataStax Studio web application locally. You can access this instance of Studio by pointing 
your browser at [http://localhost:9091][local-studio]. 

Once you open Studio, you will see several built-in notebooks, including some with "KillrVideo" in the title
which are specific to this application. For example, you should find a Notebook entitled "KillrVideo QuickStart". 
When you open it, it should look something like the following:

![KillrVideo Notebook Example](/assets/images/datastax-studio.png)

After you explore the provided KillrVideo notebook(s), you can experiment with creating your own notebooks with 
additional queries and visualizations, such as graph networks, pie charts, bar charts, scatter plots, etc.

[Next: Using DataStax Studio][next]


[next]: /docs/guides/repositories
[studio]: https://www.datastax.com/products/datastax-studio-and-development-tools
[local-studio]: http://localhost:9091
[markdown]: https://daringfireball.net/projects/markdown/