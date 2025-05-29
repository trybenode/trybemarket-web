'use client';

import Head from 'next/head';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import useUniversitySelection from '@/hooks/useUniversitySelection';

export default function SelectUniversityPage() {
  const {
    universities,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    handleSelectUniversity,
  } = useUniversitySelection();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Head>
        <title>Select Your University - Trybe Market</title>
        <meta
          name="description"
          content="Choose your university to complete your Trybe Market profile."
        />
      </Head>
      <Card className="w-full max-w-md shadow-md p-2">
        <CardHeader className="space-y-1 items-center">
          <div className="h-20 w-40 relative mb-2">
            <Image
              src="/assets/logo.png"
              alt="App Logo"
              fill
              className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Select Your University</CardTitle>
          <CardDescription>
            Search and select your university to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search universities..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
                aria-label="Search Universities Input"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loading ? (
                <p className="text-center text-gray-500">Loading universities...</p>
              ) : error ? (
                <p className="text-center text-red-500">{error}</p>
              ) : universities.length === 0 ? (
                <p className="text-center text-gray-500">No universities found.</p>
              ) : (
                <ul className="space-y-2">
                  {universities.map((university) => (
                    <li key={university.name}>
                      <Button
                        variant="outline"
                        className="w-full text-left justify-start"
                        onClick={() => handleSelectUniversity(university)}
                        disabled={loading}
                      >
                        {university.name}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}