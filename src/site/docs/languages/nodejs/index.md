# Getting Started with Node.js

The Node.js version of KillrVideo is a reference application for Node developers looking to
learn more about using [Apache Cassandra][cassandra] and [DataStax Enterprise][dse] in their
applications and services. It contains sample code that uses:

- The [DataStax Node.js Driver][driver] for Cassandra
- Google's [Grpc][grpc]

These instructions assume you already have [Node.js][node] and npm installed, as well as an 
IDE like [WebStorm][webstorm], [Visual Studio Code][vscode], [Atom][atom], or 
[Sublime Text 3][sublime3] on your local machine.

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
    You should end up with the build output in the `dist` folder.

1. Setup the Docker environment for the first time by running:
    ```
    > ./setup-docker.sh
    ```
    Or on Windows:
    ```
    > .\setup-docker.bat
    ```
    This should create a `.env` file with some environment variables, as well as pull all the
    Docker images that the application needs to run.

1. Start the docker dependencies that you just pulled down via `docker-compose`:
    ```
    > docker-compose up -d
    ```
    This starts up things like a DataStax Enterprise node, the Web UI, etc. You can learn
    more about how we use Docker in our [Docker Guide][docker-guide] documentation.
  
## Running the Code

Now that you've got the environment setup and the project built, you can run the project and
explore the code in your IDE of choice with a debugger attached.

### Running in WebStorm

### Running in Visual Studio Code

The repository you cloned has a `.vscode` folder checked-in. The `launch.json` file contains
a task named **Launch** that can be used by Visual Studio Code to launch the transpiled code
in the `dist` folder with a debugger attached. 

1. Open the root project folder with Visual Studio Code.
1. Press **`F5`** to launch the application and debugger via the task in `launch.json`.

Since source maps are generated as part of the build and supported by Visual Studio Code, you 
can place breakpoints in the original source files (under `src`) to step through the code.

### Running in Atom

### Running in Sublime Text 3

## Opening the Web UI

When KillrVideo starts, you'll see a bunch of log output to the console telling you about the
various things it's doing. You should see output that looks something like this:

![Console Startup Output](/assets/images/nodejs-startup.png)

One of the last lines in the log output will tell you where to open a web browser in order to
see the web application. The web UI makes calls to the Node.js microservices running on your
local machine. Look in the `/src/services` folder to explore the service code and add
breakpoints. As you interact with the web UI, you'll trigger those breakpoints in the service 
code.

## Learn More

Check out the [Documentation][docs] section for a lot more information on the architecture of
KillrVideo and how the Web Tier interacts with the microservices running on your machine.


[cassandra]: http://cassandra.apache.org/
[dse]: http://www.datastax.com/products/datastax-enterprise
[driver]: https://github.com/datastax/nodejs-driver
[grpc]: http://www.grpc.io/
[node]: https://nodejs.org/
[webstorm]: https://www.jetbrains.com/webstorm/
[vscode]: https://code.visualstudio.com/
[atom]: https://atom.io/
[sublime3]: https://www.sublimetext.com/3
[docker]: https://www.docker.com/
[getting-started]: /getting-started/
[repo]: https://github.com/KillrVideo/killrvideo-nodejs
[docker-guide]: /docs/guides/docker/
[docs]: /docs/