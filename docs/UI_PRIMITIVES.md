# UI Primitives

Catalogo de primitivos creados en la sesion A para reutilizar el sistema visual de la home sin introducir tokens nuevos.

| Primitivo | Archivo | API principal | Uso actual |
|---|---|---|---|
| Button | `frontend/src/components/Button.jsx` | `variant=primary|secondary|ghost`, `size=sm|md|lg`, `as` | `Hero.jsx`, `InicioPage.jsx` |
| Card | `frontend/src/components/Card.jsx` | `as`, `className`, `children` | Cards de ranking, retos y feature cards en `InicioPage.jsx` |
| Section | `frontend/src/components/Section.jsx` | `eyebrow`, `title`, `description`, `headerAction`, `containerClassName` | Secciones principales en `InicioPage.jsx` |
| Badge | `frontend/src/components/Badge.jsx` | `variant=ok|warn|err|info`, `as`, `className` | Eyebrows de cards en `InicioPage.jsx` |
| StatPill | `frontend/src/components/StatPill.jsx` | `value`, `label`, `icon`, `layout=stack|inline` | Stats de home y hero |

## Button

`Button` usa tokens Tailwind existentes: `accent`, `accent-hover`, `surface`, `gold`, `fg-strong`. No crea variables CSS nuevas. El tamano `md` usa `min-h-11` (44px) y `lg` usa `min-h-12` (48px).

```jsx
<Button as={Link} to="/votar" variant="primary" size="lg">
  Votar ahora
</Button>
```

## Card

`Card` es un shell semantico. No impone padding para no alterar layouts existentes; el espacio se pasa con `className`.

```jsx
<Card as={Link} to="/games/anigrid" className="p-5">
  <h3>AniGrid</h3>
</Card>
```

## Section

`Section` centraliza el wrapper responsive de secciones y el patron `eyebrow + title + description`. Acepta `as={motion.section}` para conservar animaciones existentes.

```jsx
<Section
  as={motion.section}
  eyebrow="Torneos"
  title="Brackets en marcha"
  headerAction={<Link to="/torneos">Ver todos</Link>}
>
  <TorneoGrid />
</Section>
```

## Badge

`Badge` cubre etiquetas pequenas. Los tonos semanticos son `ok`, `warn`, `err` e `info`; tambien acepta `className` para tonos ya existentes en una pagina.

```jsx
<Badge variant="warn">Top 10</Badge>
```

## StatPill

`StatPill` cubre stats numericos en modo vertical o inline con icono.

```jsx
<StatPill value={<CountUp target={1086} />} label="Personajes" />
<StatPill icon={Trophy} value="13" label="Torneos" layout="inline" />
```

## Decisiones

- No se duplico `Avatar.jsx`: ya existe un componente `Avatar` de usuario con API `user, size, className`; un wrapper de personaje requeriria otro nombre o una ampliacion de API fuera de esta sesion.
- No se creo `Tooltip.jsx`: se detectaron `title` y `aria-label`, pero no 3+ tooltips inline con divs absolutos que justificasen el primitivo pedido.
- `Card` mantiene spacing opt-in para no invadir el territorio de layout responsive.
