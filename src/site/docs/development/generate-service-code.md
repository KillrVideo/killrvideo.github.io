# Generate Service Code

The `.proto` files that you pulled in from the [killrvideo-service-protos][service-protos]
project contain all the service definitions for KillrVideo. You can use these service
definitions along with the [Grpc][grpc] compiler plugin to generate code for use in your
implementation. The Grpc library and compiler are available in many programming languges.
The [Grpc docs][grpc-docs] have detailed instructions that you should follow based on the
programming language your implementation is in, but the general steps for generating service
code are:

1. Install Grpc (using the [install instructions][grpc-install] in the docs). This usually 
involves installing a package using the package manager for your programming language (i.e.
Maven or Gradle in Java, NuGet in .NET, pip in Python, etc.).
1. Generate the code using the Grpc plugin for the Protobuf compiler. Again, follow the
[instructions for generating code][grpc-generate] in the docs. You'll want to generate code
for all of the [killrvideo-service-protos][service-protos] files that you pulled in as a Git
subtree.

Once you've done that, you should have client and server stubs, as well as request/response
objects and event objects. If possible, you'll want to check the generated code into your
implementation's source tree such that the implementation code you write won't conflict with
those generated files. For example, in the [.NET implementation][csharp], we had the Protobuf
compiler generate files with a `.generated.cs` in the source tree. When creating our service
implementations, we then wrote that code is seperate `.cs` files so that we could potentially
regenerate the stub code without overwriting our implementation code.

## When to Generate Code

You'll have to decide, based on your programming language's idioms, when to generate code. 
This could be, for example, every time the project is compiled (which is the default 
behavior of Grpc in Java for example), or as a seperate step executed on-demand (for 
example, using a seperate shell script you've created). Regardless of how you choose to do 
it, you want to make sure that you have a repeatable way to generate code checked in to the 
Git repo so that you can regenerate those files any time the service definitions are 
updated.

[service-protos]: https://github.com/KillrVideo/killrvideo-service-protos
[grpc]: http://www.grpc.io/
[grpc-docs]: http://www.grpc.io/docs/
[grpc-install]: http://www.grpc.io/docs/#install-grpc
[grpc-generate]: http://www.grpc.io/docs/#generating-grpc-code
[csharp]: https://github.com/luketillman/killrvideo-csharp