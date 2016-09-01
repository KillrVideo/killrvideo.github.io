# Getting Started with Node.js

The Node.js version of KillrVideo is a reference application for Node developers looking to
learn more about using [Apache Cassandra][cassandra] and [DataStax Enterprise][dse] in their
applications and services. It contains sample code that uses:

- The [DataStax Node.js Driver][driver] for Cassandra
- Google's [Grpc][grpc]

These instructions assume you already have an IDE like [WebStorm][webstorm], [Visual Studio Code][vscode], 
[Atom][atom], or [Sublime Text 3][sublime3] installed on your local machine.

## Cloning and Setup

Like all KillrVideo implementations, the Node.js version uses [Docker][docker] to run all its
dependencies in your local development environment. If you haven't already, please read and
follow the instructions in [Getting Started][getting-started] to install Docker. Once you
have Docker up and running, follow these steps:

1. Clone the Node.js project's [GitHub repository][repo]:
    ```
    > git clone https://github.com/KillrVideo/killrvideo-nodejs.git
    ```
1. From the root of the repository, use `npm` to install all dependencies:
    ```
    > npm install
    ```
1. We use `npm` scripts defined in the project's `package.json` to do our build (i.e.
transpile JavaScript, copy `.proto` files to the correct location, etc). Run a build now by
doing:
    ```
    > npm run build
    ```
    You should end up with the build output in the `./dist` folder.

1. Setup the Docker environment for the first time by running:
    ```
    > setup-docker.sh
    ```
    Or on Windows:
    ```
    > setup-docker.bat
    ```
    This should create a `.env` file with some environment variables, as well as pull all the
    Docker images that the application needs to run.

1. Start the docker dependencies that you just pulled down via `docker-compose`:
    ```
    > docker-compose up -d
    ```
    This starts up things like a DataStax Enterprise node, the Web UI, etc. You can learn
    more about how we use Docker in our [Docker Guide][docker-guide] documentation.

[cassandra]: http://cassandra.apache.org/
[dse]: http://www.datastax.com/products/datastax-enterprise
[driver]: https://github.com/datastax/nodejs-driver
[grpc]: http://www.grpc.io/
[webstorm]: https://www.jetbrains.com/webstorm/
[vscode]: https://code.visualstudio.com/
[atom]: https://atom.io/
[sublime3]: https://www.sublimetext.com/3
[docker]: https://www.docker.com/
[getting-started]: /getting-started/
[repo]: https://github.com/KillrVideo/killrvideo-nodejs
[docker-guide]: /docs/guides/docker/
[docs]: /docs/