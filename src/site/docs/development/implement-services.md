# Implement the Services

With all the setup out of the way, now you're ready to write some actual service code. You 
should have stub code generated for each service and its methods after following the
[Generate Service Code][generate-service-code] step. You also have the schema available in
DSE for storing all the data the services need to fulfill their contracts. So how do you get 
started filling in the stubs with real implementation code? Here are some tips.

## Reference other Language Implementations

Luckily, you're standing on the shoulders of giants (or at least, other programmers who have
gone through this same exercise before). Translate the work they've done into idiomatic code
for the language you're working in. Here are some other implementations to use as a reference:

- [Node.js][killrvideo-nodejs]
- [C\# / .NET][killrvideo-csharp]

## Create Idiomatic Examples

Even though you'll probably be using other implementations as a reference, remember that at
the end of the day this is going to be used by programmers familiar with your language.
There's also a good chance some of your code may get copy-pasted directly and then modified
for use in their own programs. As a result, you want to make sure you're creating code that
shows off best practices and follows the idioms of your programming language.

The way you see things being done in the JavaScript and C\# examples above may not translate
well to your lanauge or may not be the best way to go about things in your language and that's
OK. In fact, it's probably to be expected. Here are some questions you should ask yourself
when writing the service code:

1. **Sync or async?** Most of the Cassandra drivers offer both sync and async APIs. When
writing your service code, do you need to show examples of both? What do most people use in
your language when building applications these days? (Hint: It's probably all async.)
1. **What features should I show examples of?** Is there a specific feature offered
in your language that would be good to show off? For example, in Java, we might want to
include an example of using the built-in object mapper, or in C\# we might want to include
an example of using the LINQ driver.
1. **What other libraries should be included?** There's more to building applications and 
services than just interacting with the Cassandra drivers. What other popular libraries are
people likely to use in their applications? For example, in C\# we might use an IoC container
for injecting dependencies or in Java we might show an example using Spring.

Provide a wide variety of service method implementations that cover the most common usages in
your programming language. A great example of this is [Node.js][killrvideo-nodejs] where 
there are currently three common ways people do asynchronous programming and try to avoid a
lot of nested callbacks. One is via the popular `async` library on NPM, another is using the
`Promise` type and its API, and the last is via the new `async` and `await` keywords coming in
the next version of JavaScript. We provided examples of all those in our service code.

## Translating to and from gRPC Types

One problem you'll have to solve is the mismatch between types that you get on the gRPC
requests and responses versus the types used in your programming language and expected by the
Cassandra driver. There are two main cases you'll be dealing with.

#### Timestamp

Many of the request and responses need date and time information. For those fields, we've used
the `google.protobuf.Timestamp` type which is part of Google's [Well-Known Types][well-known-types]
package. Your programming language's gRPC or Protocol Buffers library may already contain
code to convert between that type and the appropriate date and time type for your language. If
not, it's fairly straightforward to convert manually by taking a look at how the 
[`Timestamp` type is defined][timestamp-def] by that package.

#### UUID and TimeUUID

Cassandra makes heavy use of `UUID` and `TimeUUID` types, so it's not a surprise that the
KillrVideo API would use them as well for unique identifiers. Unfortunately, Protocol Buffers
does not support them via a [Well-Known type][well-known-types] like we had with `Timestamp`.
As a result, we decided to [define][common-types-proto] and use two common types of our own
in the service definitions: `killrvideo.common.Uuid` and `killrvideo.common.TimeUuid`. If you
take a look at the [definitions][common-types-proto] for those types, you'll see it should be
pretty straightforward to convert to/from them.

They contain a single field, `value` which is just a `string` representation of the `UUID` or
`TimeUuid`. We chose this since it seemed like the lowest common denominator across multiple
lanaguges. All the programming languages we looked at had built-in methods for converting
their native types to/from a `string` version.

## Running multiple gRPC Services together in-process

As you start implementing the services, one thing to keep in mind is that all of the service
implementations should be setup to run in-process together. It's true that in a real
microservices applicaiton, we would run each gRPC service in its own process at its own
endpoint. But for users trying our your microservices implementation for themselves, they'll
want to be able to start and debug a single process.

The server implementation that comes with gRPC supports binding multiple services to a single
server endpoint. See the documentation for your programming language's package for the 
relevant API.


[generate-service-code]: /docs/development/generate-service-code/
[killrvideo-nodejs]: https://github.com/KillrVideo/killrvideo-nodejs
[killrvideo-csharp]: https://github.com/LukeTillman/killrvideo-csharp
[well-known-types]: https://developers.google.com/protocol-buffers/docs/reference/google.protobuf
[timestamp-def]: https://developers.google.com/protocol-buffers/docs/reference/google.protobuf#google.protobuf.Timestamp
[common-types-proto]: https://github.com/KillrVideo/killrvideo-service-protos/blob/master/src/common/common_types.proto