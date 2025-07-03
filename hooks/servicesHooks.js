import {db, auth} from '../lib/firebase';
import { addDoc, setDoc, getDoc, getDocs, query, where, collection, doc } from 'firebase/firestore';



const getServices = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    const servicesRef = collection(db, 'services');
    const q = query(servicesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const services = [];
    querySnapshot.forEach((doc) => {
      services.push({ id: doc.id, ...doc.data() });
    });
    
    return services;
  } catch (error) {
    console.error("Error fetching services:", error);
    throw error;
  }
}


//used on explore page
const getServiceById = async (serviceId) => {
  try {
    if (!serviceId) {
      throw new Error('Service ID is required');
    }
    const serviceRef = doc(db, 'services', serviceId);
    const serviceSnap = await getDoc(serviceRef);
    
    if (serviceSnap.exists()) {
      return { id: serviceSnap.id, ...serviceSnap.data() };
    } else {
      console.log("No service found with ID:", serviceId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching service by ID:", error);
    throw error;
  }
};

export { getServices, getServiceById };