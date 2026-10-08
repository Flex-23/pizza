# Pizza Day & Night

An ordering site I built for a pizzeria in Karlsruhe. Customers browse the menu,
fill a cart and check out for delivery or pickup, and the shop sees the order the
moment it lands. The storefront is German; the dashboard the owner works in is
Arabic.

The thing I cared about most was that nobody should have to open an editor to run
the shop. There is not a single dish, price or opening hour written into the
source. Categories, dishes, photos, discounts, delivery fees, business hours and
the "we're closed right now" switch all live in the database and are edited from
the dashboard. Change a price there and the next visitor sees it.

## What it does

Customers get a searchable menu with photos and category filters, a cart that
survives a reload, and a checkout that handles delivery and pickup. They can
order as a guest or keep an account with their saved addresses and past orders.
Where the owner allows it for a particular dish, a customer can attach a short
note to it, the usual "no onions" kind of thing.

The dashboard has two levels. The owner gets everything: menu, categories, staff
accounts, daily and monthly reports, settings. A manager gets the shift work,
which is the live order queue, opening hours, and a board for marking a dish sold
out in the middle of service. Each role signs in at its own address, and neither
can reach the other's pages.

Orders print on the shop's thermal printer by themselves, without anyone opening
the dashboard. The site is hosted and the printer is not, so a small agent runs
on the shop's computer, asks the site every few seconds whether a receipt is
waiting, prints it, and reports back. Every order makes two slips: the customer's
copy with the prices and a QR code that opens the delivery address in Maps, and a
stripped down kitchen ticket carrying only the dishes and their notes. If you
want the details, I wrote them up in [PRINTING.ar.md](PRINTING.ar.md).

Two things in there took far longer than I expected. The business day rolls over
at 05:00 instead of midnight, so an order placed at 2am still belongs to the
previous night's takings and the kitchen's ticket numbers don't restart in the
middle of a shift. And no price ever comes from the browser: checkout sends dish
ids and quantities, and the server reads back every price, discount and delivery
fee from the database before it writes anything.

## Built with

Next.js on the App Router with TypeScript, Tailwind for styling, shadcn/ui for
the components. Data goes through Prisma to PostgreSQL on Supabase. Validation is
Zod, and the TypeScript types are inferred from those schemas rather than written
twice. Forms are react-hook-form, the cart is Zustand, the two languages are
next-intl. Sessions are signed JWTs in httpOnly cookies, passwords are bcrypt.
Hosted on Vercel.

## Running it

You need Node 20 or newer and a PostgreSQL database.

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET at least
npm run db:push
npm run create:master        # your first dashboard account
npm run dev
```

That gives you the site on `localhost:3000`. The dashboard is not linked from
anywhere on the storefront, which is on purpose; its route is a constant in the
source and you'll find it quickly enough in your own copy.

If you don't feel like typing out the categories, `npm run seed:categories` puts
the names in for you. It adds no dishes and no prices.

Other scripts worth knowing: `npm run typecheck`, `npm run lint`,
`npm run format`, `npm run db:studio` to browse the data, and
`npm run print:test` to send a receipt to a printer or render one to a PNG
without burning a roll of paper.

Deployment notes are in [DEPLOY.ar.md](DEPLOY.ar.md).
