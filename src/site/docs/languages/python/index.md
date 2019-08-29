# Getting Started with Python

The Python version of KillrVideo is a reference application for Python developers looking to
learn more about using [Apache Cassandra][cassandra] and [DataStax Enterprise][dse] in their
applications and services. It contains sample code that uses:

- The [DataStax Python Driver][driver] for Cassandra
- Google's [gRPC][grpc]

These instructions assume you already have [Python 3][python3] installed, as well as an 
IDE that supports debugging with source maps like [PyCharm][pycharm] or 
[IntelliJ IDEA][intellij] on your local machine.

We recommend creating a virtual environment for this configuration, using the provided `requirements.txt` file.

## Cloning and Setup

Like all KillrVideo implementations, the Python version uses [Docker][docker] to run all its
dependencies in your local development environment. If you haven't already, please read and
follow the instructions in [Getting Started][getting-started] to install Docker. Once you
have Docker up and running, follow these steps:

1. Clone the Python project's [GitHub repository][repo]:
    ```
    > git clone https://github.com/KillrVideo/killrvideo-python.git
    ```
    
1. From the root of the repository, create and activate a Python virtual environment to use with this project. This 
will cause the Python libraries referenced in the `requirements.txt` to be installed:
    ```
    > python3 -m venv venv
    > source venv/bin/activate
    ```

1. To run the entire KillrVideo application including the Python services in Docker, use  `docker-compose`:
    ```
    > docker-compose up -d
    ```
    This starts up things like a DataStax Enterprise node, the Web UI, etc. You can learn
    more about how we use Docker in our [Docker Guide][docker-guide] documentation.
    
1. To bring down the KillrVideo application, run:
    ```
    > docker-compose down
    ```
    
## Running the Python services outside of Docker

The configuration above runs the Python services in Docker. If you'd like to run the Python services
outside of Docker, for example to do development and debugging work, an alternate configuration is available.

1. To run the KillrVideo application minus the Python services in Docker, use the provided script:
    ```
    > scripts/run-docker-backend-external.sh
    ```
    
1. To run the KillrVideo services in Python use the command:
    ```
    > python killrvideo/__init__.py
    ```

### Running in PyCharm or IntelliJ IDEA

To debug in [PyCharm][pycharm] or [IntelliJ IDEA][intellij], you'll first need to create a Run/Debug configuration.

1. Loading the application code as a project in the IDE.

1. Select `File->Project Structure` from the menu and select the virtual environment created above as the 
Project SDK.

1. Find the KillrVideo module main file `killrvideo/__init__.py`, right click and select `Run` or `Debug` as
desired.

## Opening the Web UI

When the Python services start, you may see repeated attempts in the output to connect to DataStax Enterprise
 (DSE). This behavior is expected, especially the first time you run the application and the database is being
 initialized. The services should connect within a couple of minutes. Once the application has initialized you can
 open the web application at `http://localhost:3000`.

The services are exercised by your actions on the Web UI, as well as the KillrVideo Generator which runs as part
of the default configuration.

## Using DataStax Studio

The `docker-compose` file that you ran above started an instance of [DataStax Studio][studio], 
an interactive tool for querying, exploring, analyzing, and visualizing both graph and tabular data. 
Check out the [Using DataStax Studio][using-studio] page for more information.

## Learn More

Check out the [Documentation][docs] section for a lot more information on the architecture of
KillrVideo and how the Web Tier interacts with the microservices running on your machine.


[cassandra]: http://cassandra.apache.org/
[dse]: http://www.datastax.com/products/datastax-enterprise
[driver]: https://github.com/datastax/python-driver
[grpc]: http://www.grpc.io/
[python3]: https://www.python.org/downloads/
[pycharm]: https://www.jetbrains.com/pycharm/
[intellij]: https://www.jetbrains.com/idea/
[docker]: https://www.docker.com/
[getting-started]: /getting-started/
[repo]: https://github.com/KillrVideo/killrvideo-python
[docker-guide]: /docs/guides/docker/
[docs]: /docs/
[studio]: https://www.datastax.com/products/datastax-studio-and-development-tools
[using-studio]: /docs/guides/datastax-studio/
