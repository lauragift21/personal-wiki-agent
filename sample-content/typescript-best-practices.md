# TypeScript Best Practices & Advanced Patterns

## Introduction

TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds static type checking, enabling better tooling, refactoring, and catching errors at compile time.

## Core Types

### Basic Types

```typescript
// Primitives
const name: string = "Alice";
const age: number = 30;
const isActive: boolean = true;
const nothing: null = null;
const notDefined: undefined = undefined;

// Arrays
const numbers: number[] = [1, 2, 3];
const names: Array<string> = ["Alice", "Bob"];

// Tuples
const point: [number, number] = [10, 20];
const user: [string, number, boolean] = ["Alice", 30, true];

// Enums
enum Status {
  Pending,
  InProgress,
  Completed
}

// Better: Const enums or string literals
const enum StatusConst {
  Pending = "pending",
  InProgress = "in_progress",
  Completed = "completed"
}
```

### Object Types

```typescript
// Interface vs Type
interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: Date; // Optional
}

type UserType = {
  id: number;
  name: string;
  email: string;
};

// Key differences
interface Admin extends User {
  permissions: string[];
}

type AdminType = UserType & {
  permissions: string[];
};

// Index signatures
interface Dictionary {
  [key: string]: string;
}

const translations: Dictionary = {
  hello: "bonjour",
  goodbye: "au revoir"
};
```

## Type Inference

### When to Explicitly Type

```typescript
// Good: Let TypeScript infer
const user = { name: "Alice", age: 30 }; // inferred as { name: string; age: number }
const numbers = [1, 2, 3]; // inferred as number[]

// Explicit types needed
function processUser(user: User): ProcessedUser {
  // Complex return type needs explicit definition
}

// Function parameters (always need types)
function greet(name: string, greeting?: string): string {
  return `${greeting ?? "Hello"}, ${name}!`;
}
```

## Advanced Types

### Union and Intersection Types

```typescript
// Union types (OR)
type Status = "pending" | "approved" | "rejected";
type ID = string | number;

function processId(id: ID) {
  if (typeof id === "string") {
    // TypeScript knows this is string
    return id.toUpperCase();
  }
  // TypeScript knows this is number
  return id.toFixed(2);
}

// Discriminated unions
type Action =
  | { type: "ADD"; payload: number }
  | { type: "REMOVE"; payload: number }
  | { type: "RESET" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "ADD":
      return state + action.payload; // payload is number
    case "REMOVE":
      return state - action.payload; // payload is number
    case "RESET":
      return 0; // no payload
  }
}

// Intersection types (AND)
type Employee = {
  name: string;
  employeeId: number;
};

type Manager = {
  department: string;
  reports: Employee[];
};

type ManagerEmployee = Employee & Manager;
```

### Utility Types

```typescript
// Partial - all properties optional
type PartialUser = Partial<User>;

// Required - all properties required
type RequiredUser = Required<User>;

// Pick - select specific properties
type UserBasicInfo = Pick<User, "name" | "email">;

// Omit - remove specific properties
type UserWithoutId = Omit<User, "id">;

// Record - object with specific keys and values
type UserRoles = Record<string, string[]>;
const roles: UserRoles = {
  alice: ["admin", "editor"],
  bob: ["viewer"]
};

// ReturnType - extract return type
type ProcessUserReturn = ReturnType<typeof processUser>;

// Parameters - extract parameter types
type ProcessUserParams = Parameters<typeof processUser>;

// Readonly - immutable
type ReadonlyUser = Readonly<User>;

// DeepReadonly

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

### Conditional Types

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// Extract from union
type StringValues = Extract<string | number | boolean, string>; // string

// Exclude from union
type NonStringValues = Exclude<string | number | boolean, string>; // number | boolean

// Infer type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Mapped types
type Nullable<T> = { [K in keyof T]: T[K] | null };
```

## Generic Patterns

### Basic Generics

```typescript
// Generic function
function identity<T>(arg: T): T {
  return arg;
}

// Generic with constraints
function logLength<T extends { length: number }>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength("hello"); // string has length
logLength([1, 2, 3]); // array has length
// logLength(123); // Error: number doesn't have length

// Multiple generics
function mapObject<K extends string, V, R>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => R
): Record<K, R> {
  const result = {} as Record<K, R>;
  for (const key in obj) {
    result[key] = fn(obj[key], key);
  }
  return result;
}
```

### Generic Classes

```typescript
class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  peek(): T | undefined {
    return this.items[0];
  }
}

const numberQueue = new Queue<number>();
const stringQueue = new Queue<string>();
```

### Generic Components (React)

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage
<List
  items={users}
  renderItem={(user) => <span>{user.name}</span>}
  keyExtractor={(user) => user.id}
/>
```

## Type Guards

### Built-in Type Guards

```typescript
// typeof
type Primitive = string | number | boolean;
function processPrimitive(value: Primitive) {
  if (typeof value === "string") {
    return value.toUpperCase(); // string methods available
  }
  if (typeof value === "number") {
    return value.toFixed(2); // number methods available
  }
  return value; // boolean
}

// instanceof
class Dog {
  bark() {
    console.log("Woof!");
  }
}

class Cat {
  meow() {
    console.log("Meow!");
  }
}

function makeSound(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark();
  } else {
    animal.meow();
  }
}

// in operator
interface Car {
  drive(): void;
}

interface Boat {
  sail(): void;
}

function move(vehicle: Car | Boat) {
  if ("drive" in vehicle) {
    vehicle.drive();
  } else {
    vehicle.sail();
  }
}
```

### Custom Type Guards

```typescript
interface User {
  type: "user";
  name: string;
  email: string;
}

interface Admin {
  type: "admin";
  name: string;
  permissions: string[];
}

// Type predicate
function isAdmin(person: User | Admin): person is Admin {
  return person.type === "admin";
}

function greet(person: User | Admin) {
  if (isAdmin(person)) {
    console.log(`Admin ${person.name} has ${person.permissions.length} permissions`);
  } else {
    console.log(`User ${person.name} has email ${person.email}`);
  }
}

// Array filtering with type guards
const people: (User | Admin)[] = [...];

const admins = people.filter(isAdmin); // Admin[]
const users = people.filter((p): p is User => p.type === "user"); // User[]
```

## Best Practices

### Strict Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Avoid `any`

```typescript
// Bad
function processData(data: any) {
  return data.map((x) => x.value);
}

// Good - use unknown
function processData(data: unknown): Result {
  if (isValidData(data)) {
    return data.map((x) => x.value);
  }
  throw new Error("Invalid data");
}

// Type assertion when necessary
function processElement(el: unknown) {
  const element = el as HTMLElement;
  element.classList.add("active");
}
```

### Nullable Types

```typescript
// Use optional chaining and nullish coalescing
function getUserName(user?: User | null): string {
  return user?.name ?? "Anonymous";
}

// Non-null assertion (use sparingly)
const element = document.getElementById("app")!;

// Defensive null checks
function processUser(user: User | undefined) {
  if (!user) {
    throw new Error("User is required");
  }
  // TypeScript knows user is defined here
  return user.name.toUpperCase();
}
```

### Function Overloads

```typescript
// Overload signatures
function createElement(tag: "a", props: AnchorProps): HTMLAnchorElement;
function createElement(tag: "div", props: DivProps): HTMLDivElement;
function createElement(tag: "span", props: SpanProps): HTMLSpanElement;
function createElement(tag: string, props: any): HTMLElement {
  return document.createElement(tag);
}

// Usage
const anchor = createElement("a", { href: "https://example.com" });
const div = createElement("div", { className: "container" });
```

### Module Augmentation

```typescript
// Extend existing types
declare module "express" {
  interface Request {
    user?: User;
    requestId: string;
  }
}

// Extend global
declare global {
  interface Window {
    analytics: Analytics;
  }
}
```

## Error Handling Types

```typescript
// Result type for explicit error handling
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findById(id);
    if (!user) {
      return { success: false, error: new Error("User not found") };
    }
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
const result = await fetchUser("123");
if (result.success) {
  console.log(result.data.name);
} else {
  console.error(result.error.message);
}
```

## Testing with TypeScript

```typescript
// Type-safe mocks
interface Database {
  getUser(id: string): Promise<User>;
  saveUser(user: User): Promise<void>;
}

const mockDatabase: jest.Mocked<Database> = {
  getUser: jest.fn(),
  saveUser: jest.fn()
};

// Test data factories
type UserFactory = (overrides?: Partial<User>) => User;

const createUser: UserFactory = (overrides = {}) => ({
  id: "1",
  name: "Test User",
  email: "test@example.com",
  ...overrides
});

// Usage in tests
const user = createUser({ name: "Alice" });
const admin = createUser({ name: "Bob", role: "admin" });
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Total TypeScript](https://www.totaltypescript.com/) by Matt Pocock
- [Type Challenges](https://github.com/type-challenges/type-challenges)
