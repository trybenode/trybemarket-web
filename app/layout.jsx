import './globals.css'
import { Toaster } from "@/components/ui/toaster";
export const metadata = {
  title: 'trybemarket',
  description: 'student e-commerce platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
        </body>
    </html>
  )
}
