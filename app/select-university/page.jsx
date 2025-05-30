"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Toaster } from "react-hot-toast";
import useUniversitySelection from "@/hooks/useUniversitySelection";
import useUserStore from "@/lib/userStore";

export default function SelectUniversityPage() {
  const {
    universities,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    handleSelectUniversity,
  } = useUniversitySelection();

  const router = useRouter();
  const { isInitialized, isFirstTimeUser } = useUserStore();

  // Track if user is in process of selecting a university
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isFirstTimeUser()) {
      router.replace("/");
    }
  }, [isInitialized, isFirstTimeUser, router]);

  // Wrapper to handle selection and disable buttons while redirecting
  const onSelectUniversity = async (university) => {
    if (isSelecting) return; // Prevent double clicks

    setIsSelecting(true);

    try {
      await handleSelectUniversity(university);
      // If handleSelectUniversity does redirect internally,
      // no need to do anything else here
      // If not, you can do router.replace(...) here
    } catch (err) {
      // If error occurs, reset state so user can retry
      setIsSelecting(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
      <Head>
        <title>Select Your University - Trybe Market</title>
        <meta
          name='description'
          content='Choose your university to complete your Trybe Market profile.'
        />
      </Head>
      <Card className='w-full max-w-md shadow-md p-2'>
        {!isFirstTimeUser() ? (
          <CardContent className='text-center space-y-4 py-12'>
            <div className='text-red-500 text-4xl'>❌</div>
            <CardTitle className='text-xl font-semibold'>
              University Already Selected
            </CardTitle>
            <CardDescription>
              You’ve already selected a university. Please contact support if
              you need to change it.
            </CardDescription>
          </CardContent>
        ) : (
          <>
            <CardHeader className='space-y-1 items-center'>
              <div className='h-20 w-40 relative mb-2'>
                <Image
                  src='/assets/logo.png'
                  alt='App Logo'
                  fill
                  className='object-contain'
                />
              </div>
              <CardTitle className='text-2xl font-bold'>
                Select Your University
              </CardTitle>
              <CardDescription>
                Search and select your university to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='relative'>
                  <Search className='absolute left-3 top-3 h-4 w-4 text-gray-400' />
                  <Input
                    type='text'
                    placeholder='Search universities...'
                    className='pl-10'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loading || isSelecting}
                    aria-label='Search Universities Input'
                  />
                </div>
                <div className='max-h-[300px] overflow-y-auto'>
                  {loading ? (
                    <p className='text-center text-gray-500'>
                      Loading universities...
                    </p>
                  ) : error ? (
                    <p className='text-center text-red-500'>{error}</p>
                  ) : universities.length === 0 ? (
                    <p className='text-center text-gray-500'>
                      No universities found.
                    </p>
                  ) : (
                    <ul className='space-y-2'>
                      {universities.map((university) => (
                        <li key={university}>
                          <Button
                            variant='outline'
                            className='w-full text-left justify-start'
                            onClick={() => onSelectUniversity(university)}
                            disabled={loading || isSelecting}
                          >
                            {university}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
      <Toaster />
    </div>
  );
}
