import { db as firestore, auth } from '../lib/firebase';
import {
  arrayUnion,
  serverTimestamp,
  addDoc,
  collection,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
// import { auth } from '../../firebaseConfig';

const getUserIdOfSeller = async(productID) => {
  try {
    if (!productID) {
      throw new Error('Product ID is required');
    }
    console.log("Fetching seller for product:", productID);
    const docSnap = await getDoc(doc(firestore, 'products', productID));
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Product data:", data);
      return data.userId;
    } else {
      console.log("No product found with ID:", productID);
      return null;
    }
  } catch (error) {
    console.error("Error in getUserIdOfSeller:", error);
    throw error;
  }
};

const initiateConversation = async (message, senderID, receiverID, productDetails, instigatorInfo, persona) => {
  try {
    const convoID = `${senderID}${receiverID}${productDetails.id}`;
    
    // const sellerId = receiverID
    const messageObj = {
      senderID,
      text: message,
      timestamp: Date.now(),
    };

    const conversationRef = doc(firestore, 'conversation', convoID);
    const conversationSnap = await getDoc(conversationRef);

    if (conversationSnap.exists()) {
      await updateDoc(conversationRef, {
        messages: arrayUnion(messageObj),
        lastMessage: messageObj,
        updatedAt: serverTimestamp(),
        unreadBy: [receiverID],
      });
    } else {
      await setDoc(conversationRef, {
        participants: [senderID, receiverID],
        messages: [messageObj],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: messageObj,
        unreadBy: [receiverID],
        instigatorInfo,
        persona,
        product: {
          name: productDetails.name,
          imageUrl: productDetails.imageUrl,
          id: productDetails.id,
          sellerId: productDetails.sellerID
        }
      });
    }
    return convoID;
  } catch (error) {
    console.error('Error in initiateConversation:', error);
    throw error;
  }
};

const getConversationWithID = (id, setConversationData) => {
  try {
    console.log("Fetching conversation with ID:", id); // Log the conversation ID
    const docRef = doc(firestore, 'conversation', id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Fetched conversation data:", data); // Log the fetched data
        // Mark as read when opened
        markConversationAsRead(id, auth.currentUser?.uid);
        setConversationData(data);
      } else {
        console.log("Conversation doesn't exist for ID:", id); // Log if the document doesn't exist
        setConversationData(null);
      }
    });
  } catch (e) {
    console.error('Error in getConversationWithID:', e);
    return () => {};
  }
};

const addMessageToConversation = async (messageObj, conversationID) => {
  const conversationRef = doc(firestore, 'conversation', conversationID);

  try {
    const conversationSnap = await getDoc(conversationRef);
    const conversationData = conversationSnap.data();
    const otherParticipants = conversationData.participants.filter(
      id => id !== messageObj.senderID
    );

    // Use serverTimestamp for updatedAt, but keep timestamp as number for easy sorting
    await updateDoc(conversationRef, {
      messages: arrayUnion({
        ...messageObj,
        timestamp: Date.now() // Unix timestamp in milliseconds
      }),
      lastMessage: {
        ...messageObj,
        timestamp: Date.now()
      },
      updatedAt: serverTimestamp(),
      unreadBy: otherParticipants
    });
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
};

const markConversationAsRead = async (conversationID, userId) => {
  const conversationRef = doc(firestore, 'conversation', conversationID);
  try {
    const conversationSnap = await getDoc(conversationRef);
    const currentUnreadBy = conversationSnap.data()?.unreadBy || [];
    const updatedUnreadBy = currentUnreadBy.filter(id => id !== userId);
    
    await updateDoc(conversationRef, {
      unreadBy: updatedUnreadBy
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
  }
};

const getAllConversations = async (userID, setConversations) => {
  try {
    const collectRef = collection(firestore, 'conversation');
    const docref = query(collectRef, where('participants', 'array-contains', userID));
    const unsubscribe = onSnapshot(docref, (querySnapshot) => {
      const conversations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConversations(conversations);
    });
    return unsubscribe; // Return the unsubscribe function
  } catch (e) {
    console.log('Error fetching conversations:', e);
  }
}

export {
  initiateConversation,
  getConversationWithID,
  addMessageToConversation,
  getUserIdOfSeller,
  getAllConversations,
  markConversationAsRead
};