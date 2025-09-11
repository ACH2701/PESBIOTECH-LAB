import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, getDoc, query, where, Timestamp, getDocs, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import './index.css';
import logoPesu from './assets/logoPesu.png';
import axios from 'axios';


// --- !!! IMPORTANT: PASTE YOUR FIREBASE CONFIG HERE !!! ---
const firebaseConfig = {
  apiKey: "AIzaSyDzCiSuTiaa7vhXs_2GoSXLwqSjANMsRDk",
  authDomain: "pes-university-biotech-labs.firebaseapp.com",
  projectId: "pes-university-biotech-labs",
  storageBucket: "pes-university-biotech-labs.firebasestorage.app",
  messagingSenderId: "414683717628",
  appId: "1:414683717628:web:f5953b3f9c6d9b8edbdc79",
  measurementId: "G-GDHGE0MESX"
};

// --- Main App Component (Acts as a router) ---
const App = () => {
    const [db, setDb] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const auth = getAuth(app);
            setDb(firestoreDb);

            const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (!firebaseUser) {
                    try {
                        await signInAnonymously(auth);
                    } catch (error) {
                        console.error("Anonymous authentication error:", error);
                        setAuthError("Failed to establish a secure connection. Check your Firebase API keys.");
                    }
                }
                setIsLoading(false);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            setAuthError("Could not connect to the booking service. Please ensure your Firebase config is correct.");
            setIsLoading(false);
        }
    }, []);

    const handleUserUpdate = (updatedUser) => {
        setLoggedInUser(updatedUser);
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading...</div>;
    }
    
    if (authError) {
         return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-orange-500">{authError}</div>;
    }

    if (!loggedInUser) {
        return <LoginPage db={db} setLoggedInUser={setLoggedInUser} />;
    }

    return <BookingPage db={db} user={loggedInUser} onLogout={() => setLoggedInUser(null)} onUpdateUser={handleUserUpdate} />;
};


// --- Login Page Component with OTP Flow ---
const LoginPage = ({ db, setLoggedInUser }) => {
    const [step, setStep] = useState('capstone');
    const [isCapstone, setIsCapstone] = useState(null);
    const [teamMembersStr, setTeamMembersStr] = useState('');
    const [srn, setSrn] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState(''); 
    const [otp, setOtp] = useState('');
    const [userToVerify, setUserToVerify] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const appId = 'default-lab-booking-app';

    const getOrCreateTeam = async (memberSrns) => { 
        const sortedSrns = [...new Set(memberSrns)].sort();
        const teamId = sortedSrns.join('_');
        const teamsRef = collection(db, `/artifacts/${appId}/public/data/teams`);
        const teamDocRef = doc(teamsRef, teamId);
        const teamDoc = await getDoc(teamDocRef);
        if (!teamDoc.exists()) {
            await setDoc(teamDocRef, { memberSrns: sortedSrns, id: teamId });
        }
        return teamId;
    };
    
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        if (srn.toUpperCase() !== 'PES1UGBTXXX') {
            const srnRegex = /^PES1UG(22|23|24|25)BT\d{3}$/i;
            if (!srnRegex.test(srn)) {
                setError("Invalid SRN format.");
                setIsLoading(false);
                return;
            }
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
            setIsLoading(false);
            return;
        }

        try {
            await axios.post('/api/send-otp', { email: email });
            setUserToVerify({ srn, name, email, isCapstone, teamMembersStr });
            setMessage(`An OTP has been sent to ${email}. Please check your inbox.`);
            setStep('otp');
        } catch (err) {
            console.error("Send OTP error:", err);
            const errorMessage = err.response?.data?.error || 'Failed to send OTP. Please try again.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleVerifyOtp = async () => {
        setError('');
        setIsLoading(true);

        try {
            await axios.post('/api/verify-otp', { email: userToVerify.email, otp: otp });

            const usersRef = collection(db, `/artifacts/${appId}/public/data/users`);
            const q = query(usersRef, where("srn", "==", userToVerify.srn.toUpperCase()));
            const querySnapshot = await getDocs(q);
            let teamId = null;

            if (userToVerify.isCapstone) {
                const memberSrns = userToVerify.teamMembersStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                if (!memberSrns.includes(userToVerify.srn.toUpperCase())) { memberSrns.push(userToVerify.srn.toUpperCase()); }
                teamId = await getOrCreateTeam(memberSrns);
            }
            
            const userPayload = { teamId, email: userToVerify.email };

            if (querySnapshot.empty) {
                const newUser = { srn: userToVerify.srn.toUpperCase(), name: userToVerify.name, semester: "N/A", ...userPayload };
                const userDocRef = await addDoc(usersRef, newUser);
                setLoggedInUser({ id: userDocRef.id, ...newUser });
            } else {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                if (userData.name.toLowerCase() === userToVerify.name.toLowerCase()) {
                    await updateDoc(doc(db, `/artifacts/${appId}/public/data/users`, userDoc.id), userPayload);
                    setLoggedInUser({ id: userDoc.id, ...userData, ...userPayload });
                } else {
                    setStep('details');
                    setError('SRN found, but the name does not match.');
                }
            }
        } catch (err) {
            console.error("OTP Verification/Signup error:", err);
            const errorMessage = err.response?.data?.error || 'An error occurred during verification.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 'capstone') {
        return ( <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4"> <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">  <h2 className="text-2xl font-bold text-center text-blue-900 mb-2">Welcome!</h2> <p className="text-center text-slate-600 mb-8">Are you booking equipment for a capstone project?</p> <div className="flex justify-around"> <button onClick={() => {setIsCapstone(true); setStep('details')}} className="w-full mr-2 p-3 bg-blue-800 text-white font-bold rounded-lg hover:bg-blue-900 transition-all">Yes</button> <button onClick={() => {setIsCapstone(false); setStep('details')}} className="w-full ml-2 p-3 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-all">No</button> </div> </div> </div> );
    }

    if (step === 'otp') {
        return ( <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4"> <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">  <h2 className="text-2xl font-bold text-center text-blue-900 mb-1">Verify Your Email</h2> <p className="text-center text-slate-500 mb-8">Enter the 6-digit code sent to your email</p> {error && <p className="bg-orange-100 text-orange-700 p-3 rounded-lg mb-4 text-sm">{error}</p>} {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-sm">{message}</p>} <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp();}} className="space-y-4"> <div> <label className="text-sm font-semibold text-slate-700">OTP Code</label> <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="123456" required/> </div> <button type="submit" disabled={isLoading} className="w-full p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:shadow-lg hover:from-orange-600"> {isLoading ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : 'Verify & Login'} </button> <button type="button" onClick={() => setStep('details')} className="w-full text-center text-sm text-blue-800 hover:underline mt-2">Go Back</button> </form> </div> </div> );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                <div className="flex justify-center mb-6">
                    <img src={logoPesu} alt="PES University Logo" className="h-10 w-10 mr-3"/>
                </div>
                <h2 className="text-2xl font-bold text-center text-blue-900 mb-1">PES UNIVERSITY BIOTECHNOLOGY LABS</h2>
                <p className="text-center text-slate-500 mb-8">Enter your details to receive an OTP</p>
                {error && <p className="bg-orange-100 text-orange-700 p-3 rounded-lg mb-4 text-sm">{error}</p>}
                <form onSubmit={handleSendOtp} className="space-y-4">
                    {isCapstone && ( <div><label className="text-sm font-semibold text-slate-700">Team Members' SRNs</label><input type="text" value={teamMembersStr} onChange={(e) => setTeamMembersStr(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="Comma-separated SRNs" required/></div>)}
                    <div> <label className="text-sm font-semibold text-slate-700">Your SRN</label> <input type="text" value={srn} onChange={(e) => setSrn(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="e.g., PES1UG22BT001" required/> </div>
                    <div> <label className="text-sm font-semibold text-slate-700">Your Full Name</label> <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="Your full name" required/> </div>
                    <div> <label className="text-sm font-semibold text-slate-700">Your Email</label> <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="your.email@example.com" required/> </div>
                    <button type="submit" disabled={isLoading} className="w-full p-3 bg-gradient-to-br from-blue-800 to-blue-900 text-white font-bold rounded-lg hover:shadow-lg"> {isLoading ? 'Sending...' : 'Send OTP'} </button>
                    <button type="button" onClick={() => setStep('capstone')} className="w-full text-center text-sm text-blue-800 hover:underline mt-2">Go Back</button>
                </form>
            </div>
        </div>
    );
};
// --- Header Component ---
const Header = ({ user, onLogout, onEditProfile, onDeleteAccount }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    return (
        <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-20 border-b border-slate-200">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <img src={logoPesu} alt="PES University Logo" className="h-10 w-10 mr-3"/>
                <h1 className="text-xl md:text-2xl font-bold text-blue-900">PES UNIVERSITY BIOTECHNOLOGY LABS</h1>
                <div className="relative">
                    <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-100 transition">
                        <span className="font-semibold text-slate-700">{user.name}</span>
                        <svg className={`w-4 h-4 text-slate-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-30 border border-slate-200">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <p className="font-bold text-slate-800">{user.name}</p>
                                <p className="text-sm text-slate-500">{user.srn}</p>
                            </div>
                            <button onClick={() => { onEditProfile(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Edit Profile</button>
                            <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Logout</button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button onClick={() => { onDeleteAccount(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50">Delete Account</button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};


// --- Main Booking Page Component ---
const BookingPage = ({ db, user, onLogout, onUpdateUser }) => {
    const [equipmentList, setEquipmentList] = useState([]);
    const [consumablesList, setConsumablesList] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [allPastBookings, setAllPastBookings] = useState([]);
    const [allSupplyBookings, setAllSupplyBookings] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookingToCancel, setBookingToCancel] = useState(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [currentView, setCurrentView] = useState('schedule');
    
    const appId = 'default-lab-booking-app';
    const isAdmin = user && user.srn === 'PES1UGBTXXX';

    useEffect(() => {
        if (!db) return;
        const equipmentCollectionPath = `/artifacts/${appId}/public/data/equipment`;
        const q = query(collection(db, equipmentCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const schedulable = allItems.filter(item => item.bookingType === 'time');
            const consumable = allItems.filter(item => item.bookingType === 'quantity');
            setEquipmentList(schedulable);
            setConsumablesList(consumable);
            if (schedulable.length > 0 && !selectedItem) {
                setSelectedItem(schedulable[0]);
                setCurrentView('schedule');
            }
            setIsLoading(false);
        }, err => { console.error(err); setErrorMessage("Could not load equipment list."); setIsLoading(false); });
        const seedData = async () => {
            const docSnap = await getDocs(query(collection(db, equipmentCollectionPath)));
            if (docSnap.empty) {
                const initialItems = [ { id: "autoclave_01", name: "Autoclave", model: "Autoclave Model", bookingType: 'time', slotDuration: 2 }, { id: "laf_01", name: "LAF", model: "LAF Model", bookingType: 'time', slotDuration: 1 }, { id: "beaker_250ml_01", name: "Beaker 250ml", model: "Borosilicate", bookingType: 'quantity' }, { id: "flask_500ml_01", name: "Flask 500ml", model: "Erlenmeyer", bookingType: 'quantity' }, ];
                for (const item of initialItems) { await setDoc(doc(db, equipmentCollectionPath, item.id), item); }
            }
        };
        seedData();
        return () => unsubscribe();
    }, [db, appId]);
    
    useEffect(() => {
        if (!db || !selectedItem || selectedItem.bookingType !== 'time') {
            setBookings([]);
            return;
        };
        const bookingsPath = `/artifacts/${appId}/public/data/bookings`;
        const q = query(collection(db, bookingsPath), where("equipmentId", "==", selectedItem.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const startOfDay = new Date(currentDate); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(currentDate); endOfDay.setHours(23, 59, 59, 999);
            const fetchedBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startTime: doc.data().startTime.toDate() })).filter(booking => booking.startTime >= startOfDay && booking.startTime <= endOfDay);
            setBookings(fetchedBookings);
        }, err => { console.error(err); setErrorMessage("Could not load booking schedule."); });
        return () => unsubscribe();
    }, [db, selectedItem, currentDate, appId]);

    useEffect(() => {
        if(!db) return;
        const bookingsPath = `/artifacts/${appId}/public/data/bookings`;
        const q = query(collection(db, bookingsPath)); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), startTime: doc.data().startTime.toDate() }));
            const now = new Date();
            const upcoming = [];
            const past = [];
            const bookingsWithDetails = fetched.map(booking => {
                const equipment = equipmentList.find(e => e.id === booking.equipmentId);
                return {...booking, equipmentName: equipment?.name || 'Unknown', equipmentModel: equipment?.model || '' };
            });

            bookingsWithDetails.forEach(b => {
                if(b.startTime >= now) upcoming.push(b);
                else past.push(b);
            });

            setAllBookings(upcoming.sort((a,b) => a.startTime - b.startTime));
            setAllPastBookings(past.sort((a,b) => b.startTime - a.startTime));
        }, err => { console.error(err); setErrorMessage("Could not load all bookings."); });

        const consumableBookingsPath = `/artifacts/${appId}/public/data/consumableBookings`;
        const q2 = query(collection(db, consumableBookingsPath));
        const unsubscribe2 = onSnapshot(q2, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({id: doc.id, ...doc.data(), returnDate: doc.data().returnDate.toDate(), bookedAt: doc.data().bookedAt.toDate() }));
            setAllSupplyBookings(fetched.sort((a,b) => a.bookedAt - b.bookedAt));
        });

        return () => { unsubscribe(); unsubscribe2(); };
    }, [db, appId, equipmentList]);

    const handleConfirmBooking = async () => {
        if (!user || !selectedItem || selectedSlot === null) return;
    
        const slotDuration = selectedItem.slotDuration || 1;
        let userIdsToCheck = [user.id];
        
        if (user.teamId) {
            const teamsRef = doc(db, `/artifacts/${appId}/public/data/teams`, user.teamId);
            const teamDoc = await getDoc(teamsRef);
            if (teamDoc.exists()) {
                const teamMemberSrns = teamDoc.data().memberSrns;
                const usersRef = collection(db, `/artifacts/${appId}/public/data/users`);
                const teamUsersQuery = query(usersRef, where("srn", "in", teamMemberSrns));
                const teamUsersSnap = await getDocs(teamUsersQuery);
                userIdsToCheck = teamUsersSnap.docs.map(doc => doc.id);
            }
        }
        
        const allEquipmentBookingsOnDate = allBookings.concat(allPastBookings).filter(b => b.equipmentId === selectedItem.id && b.startTime.toDateString() === currentDate.toDateString());
        const relevantBookingsForDay = allEquipmentBookingsOnDate.filter(b => userIdsToCheck.includes(b.userId));
    
        if (user.teamId) {
            if (relevantBookingsForDay.length >= 2) {
                 setErrorMessage("Your team has reached the maximum of 2 slots for this item today.");
                 setIsBookingModalOpen(false);
                 return;
            }
            if (relevantBookingsForDay.length === 1) {
                const existingHour = relevantBookingsForDay[0].startTime.getHours();
                const difference = Math.abs(selectedSlot - existingHour);
                if (difference !== slotDuration) {
                    setErrorMessage("Teams can only book consecutive slots. Your second booking must be adjacent to your first.");
                    setIsBookingModalOpen(false);
                    return;
                }
            }
        } else {
             if (relevantBookingsForDay.length >= 1) {
                 setErrorMessage("You can only book one slot per day for this item.");
                 setIsBookingModalOpen(false);
                 return;
            }
        }
    
        const startTime = new Date(currentDate); startTime.setHours(selectedSlot, 0, 0, 0);
        try {
            const bookingsPath = `/artifacts/${appId}/public/data/bookings`;
            await addDoc(collection(db, bookingsPath), { equipmentId: selectedItem.id, userId: user.id, userName: user.name, userSrn: user.srn, teamId: user.teamId || null, startTime: Timestamp.fromDate(startTime), bookedAt: Timestamp.now() });
            setIsBookingModalOpen(false); setSelectedSlot(null);
        } catch (error) { console.error("Error creating booking:", error); setErrorMessage("Failed to book the slot."); }
    };
    
    const handleCancelBooking = async () => {
        if(!bookingToCancel) return;
        try {
            const bookingsPath = bookingToCancel.bookingType === 'time' ? 'bookings' : 'consumableBookings';
            const bookingDocRef = doc(db, `/artifacts/${appId}/public/data/${bookingsPath}`, bookingToCancel.id);
            await deleteDoc(bookingDocRef);
            setBookingToCancel(null);
        } catch (error) { console.error("Error cancelling booking:", error); setErrorMessage("Failed to cancel booking."); }
    };
    
    const handleProfileUpdate = async (updatedFields) => {
        if (!user) return;
        let finalFields = { ...updatedFields };

        if (updatedFields.teamMembersStr) {
            const memberSrns = updatedFields.teamMembersStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            if (user.srn && !memberSrns.includes(user.srn.toUpperCase())) {
                memberSrns.push(user.srn.toUpperCase());
            }
            const teamId = await getOrCreateTeam(memberSrns);
            finalFields.teamId = teamId;
        }
        delete finalFields.teamMembersStr;

        try {
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
            await updateDoc(userDocRef, finalFields);
            onUpdateUser({ ...user, ...finalFields });
            setIsEditProfileModalOpen(false);
        } catch (error) { console.error("Profile update failed", error); }
    };

    const handleDeleteAccount = async () => {
        if (!user || !db) return;
        const batch = writeBatch(db);
        const bookingsPath = `/artifacts/${appId}/public/data/bookings`;
        const userBookingsQuery = query(collection(db, bookingsPath), where("userId", "==", user.id));
        const userBookingsSnap = await getDocs(userBookingsQuery);
        userBookingsSnap.forEach(doc => batch.delete(doc.ref));
        const consumableBookingsPath = `/artifacts/${appId}/public/data/consumableBookings`;
        const userConsumableBookingsQuery = query(collection(db, consumableBookingsPath), where("userId", "==", user.id));
        const userConsumableBookingsSnap = await getDocs(userConsumableBookingsQuery);
        userConsumableBookingsSnap.forEach(doc => batch.delete(doc.ref));
        const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
        batch.delete(userDocRef);
        try {
            await batch.commit();
            onLogout();
        } catch (error) {
            console.error("Error deleting account and all associated data:", error);
            setErrorMessage("Failed to delete account. Please try again.");
        }
    };

    const handleMarkAsReturned = async (bookingId) => {
        const bookingRef = doc(db, `/artifacts/${appId}/public/data/consumableBookings`, bookingId);
        await updateDoc(bookingRef, { status: 'returned' });
    };

    const timeSlots = useMemo(() => {
        const duration = selectedItem?.slotDuration || 1;
        const slots = [];
        for (let hour = 9; hour < 17; hour += duration) {
            if (hour + duration > 17 && duration === 2) continue;
            if (hour + duration > 17 && duration === 1) continue;
            const endHour = hour + duration;
            const formatHour = (h) => h >= 13 ? h - 12 : (h === 0 || h === 12 ? 12 : h);
            const getPeriod = (h) => h < 12 || h === 24 ? 'AM' : (h >= 12 && h < 24 ? 'PM' : 'AM');
            
            const startLabel = `${formatHour(hour)}:00 ${getPeriod(hour)}`;
            const endLabel = `${formatHour(endHour)}:00 ${getPeriod(endHour)}`;

            slots.push({ hour, label: `${startLabel} - ${endLabel}` });
        }
        return slots;
    }, [selectedItem]);
    
    const getBookingForSlot = (hour) => bookings.find(b => b.startTime.getHours() === hour);
    
    const handleSlotClick = (hour, booking) => {
        if (booking && (booking.userId === user.id || isAdmin)) {
            setBookingToCancel({...booking, bookingType: 'time'});
            return;
        }
        if (booking) return;
        const slotTime = new Date(currentDate); slotTime.setHours(hour, 0, 0, 0);
        if (slotTime < new Date()) {
            setErrorMessage("Cannot book a slot in the past.");
            setTimeout(() => setErrorMessage(''), 3000);
            return;
        }
        setSelectedSlot(hour); setIsBookingModalOpen(true);
    };
    
    const handleDateChange = (amount) => {
        setCurrentDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setDate(newDate.getDate() + amount);
            return newDate;
        });
    };

    const MainContent = () => {
        if (currentView === 'consumableView') {
            return <ConsumableView />;
        }
         switch(currentView) {
            case 'schedule':
                return <ScheduleView />;
            case 'myBookings':
                return <BookingHistoryView user={user} upcoming={allBookings.filter(b => b.userId === user.id)} past={allPastBookings.filter(b => b.userId === user.id)} />;
            case 'supplyBookings':
                return <ConsumableBookingsListView bookings={allSupplyBookings} user={user} onCancel={setBookingToCancel} isAdmin={isAdmin} title="All Supply Bookings" />;
            case 'adminDashboard':
                return isAdmin ? <AdminDashboardView allUpcoming={allBookings} allSupplies={allSupplyBookings} onCancel={setBookingToCancel} /> : null;
            default:
                return <ScheduleView />;
        }
    };

    const ScheduleView = () => (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedItem?.name}</h2>
                    <p className="text-slate-500">{selectedItem?.model}</p>
                </div>
                <div className="flex items-center mt-4 sm:mt-0 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => handleDateChange(-1)} className="px-4 py-2 rounded-md hover:bg-slate-200 transition">‹</button>
                    <span className="font-semibold mx-4 w-32 text-center">{currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                    <button onClick={() => handleDateChange(1)} className="px-4 py-2 rounded-md hover:bg-slate-200 transition">›</button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {timeSlots.map(({ hour, label }) => {
                    const booking = getBookingForSlot(hour);
                    const isPast = new Date(new Date(currentDate).setHours(hour, 0, 0, 0)) < new Date();
                    let slotClass = 'bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-md cursor-pointer';
                    if (isPast) slotClass = 'bg-slate-200 text-slate-500 cursor-not-allowed';
                    if (booking) {
                        slotClass = (booking.userId === user.id || isAdmin)
                            ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 cursor-pointer'
                            : 'bg-slate-300 text-slate-600 cursor-not-allowed';
                    }
                    return (
                        <div key={hour} onClick={() => !isPast && handleSlotClick(hour, booking)} className={`p-4 rounded-lg text-center transition-all duration-200 ${slotClass}`}>
                            <p className="font-bold text-lg">{label}</p>
                            <p className="text-sm mt-1">{booking ? ( booking.userId === user.id ? <span className="font-semibold">Your Booking<br/>(Click to cancel)</span> : <><span className="font-semibold break-all">{booking.userName}</span><br/><span className="text-xs">{booking.userSrn}</span></> ) : (isPast ? 'Past' : 'Available')}</p>
                        </div>
                    );
                })}
            </div>
        </>
    );

    const BookingsListView = ({ bookingsToShow, showCancelButton, title }) => (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{title}</h2>
            {bookingsToShow.length > 0 ? bookingsToShow.map(booking => (
                <div key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <p className="font-bold text-blue-800">{booking.equipmentName}</p>
                        <p className="text-sm text-slate-600">{booking.userName} ({booking.userSrn})</p>
                        <p className="font-semibold mt-1">{booking.startTime.toLocaleString()}</p>
                    </div>
                    {showCancelButton && <button onClick={() => setBookingToCancel({...booking, bookingType: 'time'})} className="mt-2 sm:mt-0 ml-auto bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm font-semibold">Cancel</button>}
                </div>
            )) : <p className="text-center text-slate-500 py-8">No bookings found in this category.</p>}
        </div>
    );
    
    const ConsumableView = () => {
        const [quantity, setQuantity] = useState(1);
        const today = new Date().toISOString().split('T')[0];
        const [startDate, setStartDate] = useState(today);
        const [endDate, setEndDate] = useState(today);

        const handleConsumableBooking = async () => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if(end < start) { setErrorMessage("Return date cannot be before the start date."); return; }
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if(diffDays > 6) { setErrorMessage("Booking cannot exceed 7 days."); return; }
            if (quantity <= 0) { setErrorMessage("Quantity must be at least 1."); return; }
            try {
                const consumableBookingsPath = `/artifacts/${appId}/public/data/consumableBookings`;
                await addDoc(collection(db, consumableBookingsPath), { itemId: selectedItem.id, itemName: selectedItem.name, quantity, userId: user.id, userName: user.name, userSrn: user.srn, bookedAt: Timestamp.fromDate(start), returnDate: Timestamp.fromDate(end), status: 'booked' });
                 setCurrentView('supplyBookings');
            } catch (error) { console.error("Error booking consumable:", error); setErrorMessage("Failed to book the item."); }
        };
        const currentItemBookings = allSupplyBookings.filter(b => b.itemId === selectedItem.id);

        return (
            <div>
                 <h2 className="text-2xl font-bold text-slate-800 mb-2">{selectedItem.name}</h2>
                 <p className="text-slate-500 mb-6">{selectedItem.model}</p>
                 <div className="bg-slate-100 p-4 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity (Max 4)</label>
                        <input type="number" min="1" max="4" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">From</label>
                        <input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                     <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">To</label>
                        <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                    <button onClick={handleConsumableBooking} className="bg-orange-500 text-white p-2 rounded-lg font-semibold hover:bg-orange-600 h-10">Book Item</button>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Current Bookings for this Item</h3>
                 <div className="space-y-3">
                     {currentItemBookings.length > 0 ? currentItemBookings.map(booking => (
                         <div key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
                             <div>
                                <p className="font-bold text-blue-800">{booking.itemName} (x{booking.quantity})</p>
                                <p className="text-sm text-slate-600">{booking.userName} ({booking.userSrn})</p>
                                <p className="text-sm font-semibold text-slate-700 mt-1">Booked: {booking.bookedAt.toLocaleDateString()} - Returns: {booking.returnDate.toLocaleDateString()}</p>
                             </div>
                              {(booking.userId === user.id || isAdmin) && ( <button onClick={() => setBookingToCancel({...booking, bookingType: 'quantity'})} className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 text-sm">Cancel</button> )}
                         </div>
                     )) : <p className="text-center text-slate-500 py-4">No one has booked this item yet.</p>}
                 </div>
            </div>
        );
    };
    
    const ConsumableBookingsListView = ({ bookings, user, onCancel, isAdmin, title }) => {
        const now = new Date();
        return (
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{title}</h2>
                {bookings.length > 0 ? bookings.map(booking => {
                    const isDelayed = booking.returnDate < now && booking.status !== 'returned';
                    const canCancel = now < booking.bookedAt;
                    return (
                        <div key={booking.id} className={`bg-white p-4 rounded-lg shadow-sm border ${isDelayed ? 'border-orange-500' : 'border-slate-200'} flex flex-col sm:flex-row justify-between items-start sm:items-center`}>
                            <div>
                                <p className="font-bold text-blue-800">{booking.itemName} (x{booking.quantity})</p>
                                <p className="text-sm text-slate-600">{booking.userName} ({booking.userSrn})</p>
                                <p className="font-semibold mt-1">Booked: {booking.bookedAt.toLocaleDateString()} - Return by: {booking.returnDate.toLocaleDateString()}</p>
                                {isDelayed && <p className="text-sm font-bold text-orange-600 mt-1">DELAYED</p>}
                                {booking.status === 'returned' && <p className="text-sm font-bold text-green-600 mt-1">RETURNED</p>}
                            </div>
                            <div className="flex items-center mt-2 sm:mt-0 ml-auto space-x-2">
                                {booking.userId === user.id && booking.status !== 'returned' && <button onClick={() => handleMarkAsReturned(booking.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm font-semibold">Mark Returned</button>}
                                {((booking.userId === user.id && canCancel) || isAdmin) && <button onClick={() => onCancel({ ...booking, bookingType: 'quantity' })} className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm font-semibold">Cancel</button>}
                            </div>
                        </div>
                    )
                }) : <p className="text-center text-slate-500 py-8">No supply bookings found.</p>}
            </div>
        );
    };
    
    const AdminDashboardView = ({ allUpcoming, allSupplies, onCancel }) => (
        <div className="space-y-8">
            <BookingsListView bookingsToShow={allUpcoming} showCancelButton={true} title="All Upcoming Equipment Bookings"/>
            <ConsumableBookingsListView bookings={allSupplies} user={user} onCancel={onCancel} isAdmin={isAdmin} title="All Current Supply Bookings"/>
        </div>
    );
    
    const BookingHistoryView = ({ user, upcoming, past }) => (
        <div className="space-y-8">
            <BookingsListView bookingsToShow={upcoming} showCancelButton={true} title="My Upcoming Equipment Bookings" />
            <ConsumableBookingsListView bookings={allSupplyBookings.filter(b => b.userId === user.id)} user={user} onCancel={setBookingToCancel} isAdmin={isAdmin} title="My Supply Bookings" />
            <div className="border-t border-slate-200 pt-8 mt-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-4">My Past Bookings</h2>
                {past.length > 0 ? past.map(booking => (
                     <div key={booking.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 opacity-70">
                         <p className="font-bold text-blue-800">{booking.equipmentName}</p>
                         <p className="text-sm text-slate-600">{booking.userName} ({booking.userSrn})</p>
                         <p className="font-semibold mt-1">{booking.startTime.toLocaleString()}</p>
                     </div>
                )) : <p className="text-center text-slate-500 py-8">No past bookings found.</p>}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d8' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}>
            <Header user={user} onLogout={onLogout} onEditProfile={() => setIsEditProfileModalOpen(true)} onDeleteAccount={() => setIsDeleteAccountModalOpen(true)} />
            {errorMessage && <div className="container mx-auto mt-4 p-3 bg-orange-100 text-orange-700 rounded-lg text-center" onClick={() => setErrorMessage('')}>{errorMessage}</div>}
            <div className="container mx-auto p-4 flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-1/4 lg:w-1/5 bg-white/80 backdrop-blur-lg p-4 rounded-lg shadow-sm border border-slate-200 self-start">
                    <h2 className="text-xl font-bold mb-4 text-slate-800">Equipment</h2>
                    <div className="space-y-2">{equipmentList.map(eq => (<button key={eq.id} onClick={() => { setSelectedItem(eq); setCurrentView('schedule'); }} className={`w-full text-left p-3 rounded-lg transition-all ${selectedItem?.id === eq.id && selectedItem.bookingType === 'time' ? 'bg-blue-800 text-white shadow-md' : 'bg-white hover:bg-blue-50'}`}><p className="font-semibold">{eq.name}</p><p className="text-sm opacity-80">{eq.model}</p></button>))}</div>
                    <h2 className="text-xl font-bold mt-6 mb-4 text-slate-800">Supplies</h2>
                    <div className="space-y-2">{consumablesList.map(c => (<button key={c.id} onClick={() => { setSelectedItem(c); setCurrentView('consumableView'); }} className={`w-full text-left p-3 rounded-lg transition-all ${selectedItem?.id === c.id && selectedItem.bookingType === 'quantity' ? 'bg-blue-800 text-white shadow-md' : 'bg-white hover:bg-blue-50'}`}><p className="font-semibold">{c.name}</p></button>))}</div>
                </aside>
                <main className="flex-1 bg-white/80 backdrop-blur-lg p-6 rounded-lg shadow-sm border border-slate-200">
                    <div className="border-b border-slate-200 mb-4">
                        <nav className="flex flex-wrap -mb-px">
                            <button onClick={() => { setCurrentView('schedule'); if(equipmentList.length > 0 && (!selectedItem || selectedItem.bookingType !== 'time')) setSelectedItem(equipmentList[0]);}} className={`py-2 px-4 font-semibold whitespace-nowrap ${currentView === 'schedule' ? 'border-b-2 border-blue-800 text-blue-800' : 'text-slate-500'}`}>Schedule</button>
                            <button onClick={() => { setCurrentView('myBookings'); }} className={`py-2 px-4 font-semibold whitespace-nowrap ${currentView === 'myBookings' ? 'border-b-2 border-blue-800 text-blue-800' : 'text-slate-500'}`}>My Bookings</button>
                            {isAdmin && <button onClick={() => { setCurrentView('adminDashboard'); }} className={`py-2 px-4 font-semibold whitespace-nowrap ${currentView === 'adminDashboard' ? 'border-b-2 border-blue-800 text-blue-800' : 'text-slate-500'}`}>Admin Dashboard</button>}
                            <button onClick={() => { setCurrentView('supplyBookings'); }} className={`py-2 px-4 font-semibold whitespace-nowrap ${currentView === 'supplyBookings' || currentView === 'consumableView' ? 'border-b-2 border-blue-800 text-blue-800' : 'text-slate-500'}`}>Supply Bookings</button>
                        </nav>
                    </div>
                    {isLoading ? <p>Loading...</p> : <MainContent /> }
                </main>
            </div>
            {isBookingModalOpen && <ConfirmationModal selectedEquipment={selectedItem} selectedSlot={selectedSlot} currentDate={currentDate} onConfirm={handleConfirmBooking} onCancel={() => setIsBookingModalOpen(false)} />}
            {bookingToCancel && <CancelConfirmationModal booking={bookingToCancel} onConfirm={handleCancelBooking} onCancel={() => setBookingToCancel(null)} />}
            {isEditProfileModalOpen && <EditProfileModal user={user} onSave={handleProfileUpdate} onCancel={() => setIsEditProfileModalOpen(false)} db={db} />}
            {isDeleteAccountModalOpen && <DeleteConfirmationModal onConfirm={handleDeleteAccount} onCancel={() => setIsDeleteAccountModalOpen(false)} />}
        </div>
    );
};

// --- Child Components for Modals ---
const ConfirmationModal = ({ selectedEquipment, selectedSlot, currentDate, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-2">Confirm Booking</h3>
            <div className="bg-slate-100 p-4 rounded-lg my-4 text-sm space-y-1">
                <p><span className="font-semibold">Equipment:</span> {selectedEquipment.name}</p>
                <p><span className="font-semibold">Date:</span> {currentDate.toLocaleDateString()}</p>
                <p><span className="font-semibold">Time:</span> {`${selectedSlot % 12 === 0 ? 12 : selectedSlot % 12}:00 ${selectedSlot < 12 ? 'AM' : 'PM'}`}</p>
            </div>
            <div className="flex justify-end space-x-4"><button onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-200">Cancel</button><button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-orange-500 text-white">Confirm</button></div>
        </div>
    </div>
);
const CancelConfirmationModal = ({ booking, onConfirm, onCancel }) => {
    const bookingDetails = booking.bookingType === 'time' ? `on ${booking.startTime.toLocaleDateString()} at ${booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : `of ${booking.quantity} x ${booking.itemName} due ${booking.returnDate.toLocaleDateString()}`;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full">
                <h3 className="text-xl font-bold text-orange-600 mb-2">Cancel Booking?</h3>
                <p className="text-slate-600 mb-4">Are you sure you want to cancel the booking {bookingDetails}?</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Keep it</button>
                    <button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">Yes, Cancel</button>
                </div>
            </div>
        </div>
    );
};
const EditProfileModal = ({ user, onSave, onCancel, db }) => {
    const [name, setName] = useState(user.name);
    const [srn, setSrn] = useState(user.srn);
    const [teamMembersStr, setTeamMembersStr] = useState('');
    const [error, setError] = useState('');
    
    const appId = 'default-lab-booking-app';

    const getOrCreateTeam = async (memberSrns) => {
        const sortedSrns = [...new Set(memberSrns)].sort();
        const teamId = sortedSrns.join('_');
        const teamsRef = collection(db, `/artifacts/${appId}/public/data/teams`);
        const teamDocRef = doc(teamsRef, teamId);
        const teamDoc = await getDoc(teamDocRef);
        if (!teamDoc.exists()) {
            await setDoc(teamDocRef, { memberSrns: sortedSrns });
        }
        return teamId;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        if (srn && srn.toUpperCase() !== 'PES1UGBTXXX') {
            const srnRegex = /^PES1UG(22|23|24|25)BT\d{3}$/i;
            if (!srnRegex.test(srn)) {
                setError("Invalid SRN format.");
                return;
            }
        }

        let teamId = user.teamId;
        if (teamMembersStr) {
            const memberSrns = teamMembersStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            if (srn && !memberSrns.includes(srn.toUpperCase())) {
                memberSrns.push(srn.toUpperCase());
            }
            teamId = await getOrCreateTeam(memberSrns);
        }

        onSave({ name, srn: srn.toUpperCase(), teamId });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSave} className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full space-y-4">
                <h3 className="text-xl font-bold mb-2">Edit Profile</h3>
                {error && <p className="bg-orange-100 text-orange-700 p-3 rounded-lg text-sm">{error}</p>}
                <div>
                    <label className="text-sm font-semibold text-slate-700">Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg"/>
                </div>
                 <div>
                    <label className="text-sm font-semibold text-slate-700">Your SRN</label>
                    <input type="text" value={srn} onChange={(e) => setSrn(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="e.g., PES1UG22BT001"/>
                </div>
                <div>
                    <label className="text-sm font-semibold text-slate-700">Team Members' SRNs (for Capstone)</label>
                    <input type="text" value={teamMembersStr} onChange={(e) => setTeamMembersStr(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="Comma-separated SRNs"/>
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                    <button type="button" onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-200">Cancel</button>
                    <button type="submit" className="px-6 py-2 rounded-lg bg-orange-500 text-white">Save</button>
                </div>
            </form>
        </div>
    );
};
const DeleteConfirmationModal = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-sm w-full">
                <h3 className="text-xl font-bold text-orange-600 mb-2">Delete Account?</h3>
                <p className="text-slate-600 mb-4">Are you sure? This will permanently delete your account and all of your current and past bookings. This action cannot be undone.</p>
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onCancel} className="px-6 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Keep it</button>
                    <button onClick={onConfirm} className="px-6 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">Yes, Delete My Account</button>
                </div>
            </div>
        </div>
    );
};

export default App;

