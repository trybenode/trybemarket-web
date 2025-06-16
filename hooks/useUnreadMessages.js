import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { getAllConversations } from '@/utils/messaginghooks';

export const useUnreadMessages = () => {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setHasUnread(false);
        return;
      }

      // Set up conversation listener
      const unsubscribeConversations = getAllConversations(user.uid, (conversations) => {
        // Check if any conversation has unread messages
        const hasUnreadMessages = conversations.some(
          (conversation) => 
            Array.isArray(conversation.unreadBy) && 
            conversation.unreadBy.includes(user.uid)
        );
        setHasUnread(hasUnreadMessages);
      });

      return () => {
        if (unsubscribeConversations) {
          unsubscribeConversations();
        }
      };
    });

    return () => unsubscribe();
  }, []);

  return hasUnread;
};
