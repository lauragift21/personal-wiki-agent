# React Patterns & Best Practices

## Component Architecture

### Container/Presentational Pattern

**Container Components (Smart):**

- Handle data fetching and state management
- Pass data down via props
- Focus on how things work

**Presentational Components (Dumb):**

- Receive data via props
- Focus on how things look
- Often reusable and stateless

```tsx
// Container Component
function UserContainer() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser().then((data) => {
      setUser(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;
  if (!user) return <Error message="User not found" />;

  return <UserProfile user={user} />;
}

// Presentational Component
interface UserProfileProps {
  user: User;
}

function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="user-profile">
      <img src={user.avatar} alt={user.name} />
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </div>
  );
}
```

### Compound Components

Pattern for components that work together to form a complete UI:

```tsx
// Usage
<Select>
  <Select.Option value="1">Option 1</Select.Option>
  <Select.Option value="2">Option 2</Select.Option>
  <Select.Option value="3">Option 3</Select.Option>
</Select>;

// Implementation
import { createContext, useContext, useState } from "react";

interface SelectContextValue {
  selectedValue: string | null;
  setSelectedValue: (value: string) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function Select({ children }: { children: React.ReactNode }) {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  return (
    <SelectContext.Provider value={{ selectedValue, setSelectedValue }}>
      <div className="select">{children}</div>
    </SelectContext.Provider>
  );
}

function Option({
  value,
  children
}: {
  value: string;
  children: React.ReactNode;
}) {
  const context = useContext(SelectContext);
  if (!context) throw new Error("Option must be used within Select");

  const { selectedValue, setSelectedValue } = context;
  const isSelected = selectedValue === value;

  return (
    <div
      className={`option ${isSelected ? "selected" : ""}`}
      onClick={() => setSelectedValue(value)}
    >
      {children}
    </div>
  );
}

Select.Option = Option;
```

### Render Props Pattern

Pass a function as a child to share code between components:

```tsx
interface MouseTrackerProps {
  render: (state: { x: number; y: number }) => React.ReactNode;
}

function MouseTracker({ render }: MouseTrackerProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <div
      onMouseMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}
      style={{ height: "100vh" }}
    >
      {render(position)}
    </div>
  );
}

// Usage
function App() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <p>
          Mouse position: {x}, {y}
        </p>
      )}
    />
  );
}
```

### Higher-Order Components (HOC)

```tsx
function withLoading<T extends object>(
  WrappedComponent: React.ComponentType<T>
) {
  return function WithLoadingComponent(props: T & { isLoading: boolean }) {
    const { isLoading, ...otherProps } = props;

    if (isLoading) {
      return <div className="loading">Loading...</div>;
    }

    return <WrappedComponent {...(otherProps as T)} />;
  };
}

// Usage
const UserProfileWithLoading = withLoading(UserProfile);

function App() {
  const { data, isLoading } = useUser();
  return <UserProfileWithLoading user={data} isLoading={isLoading} />;
}
```

## Hooks Deep Dive

### Custom Hooks Patterns

**useLocalStorage:**

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  // Get stored value or use initial
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

// Usage
function App() {
  const [name, setName] = useLocalStorage("name", "Anonymous");
  return <input value={name} onChange={(e) => setName(e.target.value)} />;
}
```

**useDebounce:**

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchInput() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  return <input value={search} onChange={(e) => setSearch(e.target.value)} />;
}
```

**useAsync:**

```tsx
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

function useAsync<T>(asyncFunction: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await asyncFunction();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
      throw error;
    }
  }, [asyncFunction]);

  return { ...state, execute };
}

// Usage
function UserProfile({ userId }: { userId: string }) {
  const {
    data: user,
    loading,
    error,
    execute
  } = useAsync(() => fetchUser(userId));

  useEffect(() => {
    execute();
  }, [execute]);

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

### Hook Rules & Best Practices

**1. Only Call Hooks at the Top Level**

```tsx
// Bad: Hook inside condition
function BadComponent({ shouldFetch }) {
  if (shouldFetch) {
    const data = useData(); // ❌
  }
}

// Good: Always at top level
function GoodComponent({ shouldFetch }) {
  const data = useData();

  if (!shouldFetch) {
    return null;
  }

  return <div>{data}</div>;
}
```

**2. Custom Hook Composition**

```tsx
function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [userData, postsData] = await Promise.all([
        fetchUser(userId),
        fetchUserPosts(userId)
      ]);
      setUser(userData);
      setPosts(postsData);
      setLoading(false);
    };

    loadData();
  }, [userId]);

  return { user, posts, loading };
}
```

## State Management

### Context API Best Practices

**Avoiding Unnecessary Renders:**

```tsx
// Bad: Context value changes on every render
function BadProvider({ children }) {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

// Good: Memoize context value
function GoodProvider({ children }) {
  const [user, setUser] = useState(null);

  const value = useMemo(() => ({ user, setUser }), [user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// Better: Split contexts
const UserStateContext = createContext(null);
const UserDispatchContext = createContext(null);

function UserProvider({ children }) {
  const [user, dispatch] = useReducer(userReducer, null);

  return (
    <UserStateContext.Provider value={user}>
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  );
}

// Usage - components only re-render when state they use changes
function UserDisplay() {
  const user = useContext(UserStateContext); // Only re-renders when user changes
  return <div>{user?.name}</div>;
}

function UserUpdater() {
  const dispatch = useContext(UserDispatchContext); // Never causes re-render
  return <button onClick={() => dispatch({ type: "logout" })}>Logout</button>;
}
```

### State Colocation

Keep state as close as possible to where it's used:

```tsx
// Bad: Global state for local UI
function BadApp() {
  const [isModalOpen, setIsModalOpen] = useState(false); // In global store

  return (
    <Provider store={store}>
      <Header />
      <Main />
      {isModalOpen && <Modal />}
    </Provider>
  );
}

// Good: Local state
function GoodApp() {
  return (
    <Provider store={store}>
      <Header />
      <Main />
    </Provider>
  );
}

function ModalTrigger() {
  const [isOpen, setIsOpen] = useState(false); // Local to component

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      {isOpen && <Modal onClose={() => setIsOpen(false)} />}
    </>
  );
}
```

## Performance Optimization

### Memoization Strategies

**1. useMemo for Expensive Computations:**

```tsx
function ProductList({ products, filter }) {
  // Expensive filtering operation
  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [products, filter]
  );

  return (
    <ul>
      {filteredProducts.map((product) => (
        <ProductItem key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

**2. useCallback for Function References:**

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  // Without useCallback, Child re-renders even though handleClick is the same
  const handleClick = useCallback(() => {
    console.log("Clicked");
  }, []);

  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
      <Child onClick={handleClick} />
    </div>
  );
}

const Child = memo(function Child({ onClick }: { onClick: () => void }) {
  console.log("Child rendered");
  return <button onClick={onClick}>Click me</button>;
});
```

**3. React.memo for Component Memoization:**

```tsx
interface ExpensiveListProps {
  items: Item[];
  onItemClick: (id: string) => void;
}

const ExpensiveList = memo(
  function ExpensiveList({ items, onItemClick }: ExpensiveListProps) {
    return (
      <ul>
        {items.map((item) => (
          <li key={item.id} onClick={() => onItemClick(item.id)}>
            {item.name}
          </li>
        ))}
      </ul>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.items === nextProps.items &&
      prevProps.onItemClick === nextProps.onItemClick
    );
  }
);
```

### Virtualization

For large lists, render only visible items:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50 // Estimated row height
  });

  return (
    <div ref={parentRef} style={{ height: "400px", overflow: "auto" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative"
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Code Splitting

```tsx
// Route-based splitting
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./Dashboard"));
const Settings = lazy(() => import("./Settings"));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Component-based splitting
const HeavyChart = lazy(() => import("./HeavyChart"));

function Analytics() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<Spinner />}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

## Error Handling

### Error Boundaries

```tsx
interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    // Send to error tracking service
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="error-fallback">
            <h2>Something went wrong</h2>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}
```

## Testing Patterns

### Component Testing with React Testing Library

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Basic test
test("renders user profile", () => {
  render(<UserProfile user={{ name: "Alice", email: "alice@example.com" }} />);

  expect(screen.getByText("Alice")).toBeInTheDocument();
  expect(screen.getByText("alice@example.com")).toBeInTheDocument();
});

// User interactions
test("submits form on button click", async () => {
  const handleSubmit = jest.fn();
  render(<LoginForm onSubmit={handleSubmit} />);

  await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
  await userEvent.type(screen.getByLabelText(/password/i), "password123");
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123"
    });
  });
});

// Async data fetching
test("loads and displays user data", async () => {
  render(<UserContainer userId="123" />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

// Testing hooks
function renderHook<T>(hook: () => T) {
  let result: { current: T } = { current: null as T };

  function TestComponent() {
    result.current = hook();
    return null;
  }

  render(<TestComponent />);
  return result;
}

test("useCounter increments count", () => {
  const result = renderHook(() => {
    const [count, setCount] = useState(0);
    const increment = () => setCount((c) => c + 1);
    return { count, increment };
  });

  expect(result.current.count).toBe(0);
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

## Resources

- [React Documentation](https://react.dev/)
- [Kent C. Dodds Blog](https://kentcdodds.com/)
- [Patterns.dev](https://www.patterns.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
