React

* Use functional components, never classes.

```tsx
// Good
const Button = ({ label }: { label: string }) => <button>{label}</button>;

// Bad
class Button extends React.Component { ... }
```

* Use TypeScript and the .tsx extension for components.

* Keep component state as close as possible to where it will be used.

* Pass properties explicitly between components. Avoid spread operator.

```tsx
// Good
<Img width={100} height={100} src={url} />

// Bad
<Img {...props} />
```

* Avoid very large components, above 100 lines.

* Use Context API when you need to communicate between different child components.

```tsx
const AuthContext = createContext<AuthState | null>(null);

const AuthProvider = ({ children }: { children: ReactNode }) => (
  <AuthContext.Provider value={useAuthState()}>
    {children}
  </AuthContext.Provider>
);
```

* Use Tailwind for styling components. Do not use styled-components.

```tsx
// Good
<button className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>

// Bad
const StyledButton = styled.button`background: blue;`;
```

* Avoid an excess of small components.

* Use the useMemo hook to avoid excessive calculations and unnecessary interactions between renders.

```tsx
const sortedItems = useMemo(() => items.sort((a, b) => a.price - b.price), [items]);
```

* Before creating a new complex component, ask first if an existing library should be used.

* Create automated tests for all components.

* Always try to reuse existing components. If in doubt, ask before creating a new one.

* Always use Shadcn components
