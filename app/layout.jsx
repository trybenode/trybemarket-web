import './globals.css'

export const metadata = {
  title: 'trybemarket',
  description: 'student e-commerce platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
