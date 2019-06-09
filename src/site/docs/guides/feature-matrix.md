# Feature Matrix

KillrVideo is intended to serve as a reference application that demonstrates usage of many different features
of DataStax Enterprise. We try to support these features in each of our different language implementations, but
sometimes we're not completely at parity across all of our language implementations. 

The table below provides a mapping of DataStax Enterprise features to the location in the
[microservices tier][services] where each is implemented:


| Product | Feature | Service | Java | Node.JS | C# (.NET) | Python |
| ------- |---------| ------- |:----:|:-------:|:---------:|:------:|
| **DSE DB** <br> (Apache Cassandra) | Read / write using DataStax client drivers<ul><li>Statements (Prepared, Batch, etc.)</li><li>Asynchronous Execution (optional)</li></ul> | All services | ![X](/assets/images/checkbox-icon.png) | ![X](/assets/images/checkbox-icon.png) | ![X](/assets/images/checkbox-icon.png) | ![X](/assets/images/checkbox-icon.png) |
| **DSE Search** <br> (Apache Solr) | Searching for videos by tag and title <ul><li>Text Search</li></ul> | Search Service | ![X](/assets/images/checkbox-icon.png) | ![X](/assets/images/checkbox-icon.png) |  | ![X](/assets/images/checkbox-icon.png) |
| **DSE Graph** | Recommendation Engine <ul><li>Domain-specific language</li><li>OLTP graph traversals</li></ul> | Suggested Videos Service | ![X](/assets/images/checkbox-icon.png) | | | coming soon |
| **DSE Analytics** <br> (Apache Spark) | Calculation of platform metrics <ul><li>Views</li><li>User activities</li></ul> | (Currently available in Studio Notebooks only) | | |


Additionally, you can use DataStax tools including Studio and Ops Center with KillrVideo by launching them via official 
DSE Docker images. See the [Docker][next] page for more information.

[Next: Docker and Infrastructure Dependencies][next]

[next]: /docs/guides/docker/
[services]: /docs/guides/microservices-tier/