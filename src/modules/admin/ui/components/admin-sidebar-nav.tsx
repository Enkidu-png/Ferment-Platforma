'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { label: 'Merchants', href: '/admin/merchants' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Tags', href: '/admin/tags' },
  { label: 'Orders', href: '/admin/orders' },
];

export function AdminSidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="w-48 shrink-0 border-r h-screen p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Admin</p>
      {links.map(({ label, href }) => (
        <Link
          key={href}
          href={href}
          className={`block px-3 py-2 rounded-md text-sm hover:bg-accent ${
            pathname.startsWith(href) ? 'bg-accent font-semibold' : ''
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
