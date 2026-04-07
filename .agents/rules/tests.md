Tests

* To run the tests, use the command npm run test.

* Place tests in the folder most appropriate for the technology being used.

* Follow the extension most recommended by the testing library.

* Do not create dependencies between tests. It must be possible to run each test independently.

* Follow the Arrange, Act, Assert (or Given, When, Then) principle to ensure maximum organization and readability within tests.

```ts
it("should calculate the total with discount", () => {
  // Arrange
  const cart = new Cart();
  cart.addItem({ price: 100, quantity: 2 });

  // Act
  const total = cart.calculateTotal(0.1);

  // Assert
  expect(total).toBe(180);
});
```

* If testing behavior that depends on a Date, and this is important for what is being tested, use a Mock to ensure the test is repeatable.

```ts
const clock = sinon.useFakeTimers(new Date("2026-01-15"));
// ... test ...
clock.restore();
```

* Create tests for HTTP endpoints. These tests must NOT use libraries like supertest and must be integration tests. Also, create these tests only to verify the main and alternative flows (focusing mainly on status codes and error messages), leaving business rule variation tests for the use case tests.

* Create tests for all use cases. In this case, always test the main flows and at least one alternative flow that throws exceptions. Use the stub test pattern to avoid using external APIs at this test level.

```ts
it("should throw when user is not found", async () => {
  const userRepository = { findById: sinon.stub().resolves(null) };
  const useCase = new BlockUser(userRepository);
  await expect(useCase.execute("invalid-id")).rejects.toThrow("User not found");
});
```

* Create tests for all domain logic. Test all rule possibilities and variations, always at the unit level, without depending on any external resource.

* Focus on testing one behavior per test. Avoid writing very large tests.

* Always be clear and objective in the test description.

* Ensure the code being written is fully covered by tests.

* Create consistent expectations, ensuring that everything being tested is actually being verified.

* Always close database or messaging platform connections after running tests, if necessary.

* Use beforeEach for initialization.

* Use afterEach if you need to release resources such as database connections or messaging platforms.
