Coding Standards

* All source code must be written in English.

```ts
// Good
const invoiceAmount = 100;
// Bad
const valorDaNota = 100;
```

* Use camelCase for declaring methods, functions, and variables; PascalCase for classes and interfaces; UPPER_SNAKE_CASE for constants.

```ts
// camelCase
function calculateTotal() {}
const itemCount = 5;

// PascalCase
class PaymentGateway {}
interface UserProfile {}
```

* Naming conventions for folders and files:

**Folders** — Always use kebab-case, for both frontend and backend.

```
// Good
user-profile/
auth-service/
email-templates/

// Bad
userProfile/
AuthService/
```

**Frontend files:**

- React components: PascalCase (e.g., UserCard.tsx, LoginForm.tsx). Exception: Shadcn UI components keep their default kebab-case naming (e.g., alert-dialog.tsx, date-picker.tsx) to stay compatible with the Shadcn CLI.
- Hooks: camelCase, must start with `use` (e.g., useAuth.ts, useWindowSize.ts)
- Utilities, services, config, helpers, reducers, stores, API clients: camelCase (e.g., formatDate.ts, authService.ts, apiClient.ts)
- Styles, tests, and component-adjacent files: match the main file name (e.g., UserCard.module.css, UserCard.test.tsx)

```
// Good
components/
  UserCard.tsx
  UserCard.test.tsx
hooks/
  useAuth.ts
services/
  authService.ts
utils/
  formatDate.ts

// Bad
components/
  user-card.tsx
hooks/
  UseAuth.ts
```

**Backend files:**

- Default to camelCase for modules, services, controllers, utilities, and config files (e.g., authController.ts, userService.ts, envConfig.ts)
- Use PascalCase only when the file mainly defines a class, DTO, entity, or type (e.g., User.ts, CreateUserDto.ts, AuthGuard.ts)

```
// Good
routes/
  authRoutes.ts
services/
  userService.ts
data/
  User.ts
  CreateUserDto.ts

// Bad
routes/
  auth-routes.ts
services/
  UserService.ts
```

* Avoid abbreviations, but also don't write names that are too long (more than 30 characters).

```ts
// Good
const customerAddress = "...";
// Bad (abbreviation)
const custAddr = "...";
// Bad (too long)
const theCompleteCustomerMailingAddress = "...";
```

* Declare constants to represent magic numbers with readability.

```ts
// Good
const MAX_LOGIN_ATTEMPTS = 5;
if (attempts > MAX_LOGIN_ATTEMPTS) { ... }

// Bad
if (attempts > 5) { ... }
```

* Methods and functions must perform a clear and well-defined action, and this must be reflected in their name, which must start with a verb, never a noun.

```ts
// Good
function calculateDiscount() {}
function sendEmail() {}

// Bad
function discount() {}
function email() {}
```

* Whenever possible, avoid passing more than 3 parameters. Prefer using objects if needed.

```ts
// Good
function createUser(input: { name: string; email: string; age: number; role: string }) {}

// Bad
function createUser(name: string, email: string, age: number, role: string) {}
```

* Follow CQS (Command Query Separation), avoiding side effects when calling methods and functions. They should always have the purpose of performing a mutation or a query, never both. In these cases, prefer to separate them.

```ts
// Good — separated
function getBalance(): number { return this.balance; }
function withdraw(amount: number): void { this.balance -= amount; }

// Bad — query + mutation in the same method
function getAndResetBalance(): number {
  const balance = this.balance;
  this.balance = 0;
  return balance;
}
```

* Avoid nesting more than two conditional commands (if/else), always preferring early returns and avoiding the use of else.

```ts
// Good
function process(order: Order) {
  if (!order) return;
  if (!order.isValid()) return;
  // main logic here
}

// Bad
function process(order: Order) {
  if (order) {
    if (order.isValid()) {
      if (order.hasItems()) {
        // deeply nested
      }
    }
  }
}
```

* Avoid using flag params to switch the behavior of methods and functions. In these cases, prefer to separate them into specific behaviors.

```ts
// Good
function sendEmailAsText(content: string) {}
function sendEmailAsHtml(content: string) {}

// Bad
function sendEmail(content: string, isHtml: boolean) {}
```

* Avoid long methods, with more than 50 lines. Prefer to split them.

* Avoid long classes, with more than 300 lines. Prefer to split them.

* Avoid the use of comments whenever possible.

* Never declare more than one variable on the same line.

```ts
// Good
const name = "John";
const age = 30;

// Bad
const name = "John", age = 30;
```

* Declare variables as close as possible to where they will be used.
