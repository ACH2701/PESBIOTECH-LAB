import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, getDoc, query, where, Timestamp, getDocs, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import './index.css';
import logoPesu from './assets/logoPesu.png';
import axios from 'axios';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { useState, useEffect } from 'react';

const DarkModeToggle = () => {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [dark]);
  return (
    <button
      className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow"
      onClick={() => setDark(!dark)}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  );
};

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

// --- Dark Mode Toggle ---
const DarkModeToggle = () => {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [dark]);
  return (
    <button
      className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow"
      onClick={() => setDark(!dark)}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  );
};

// --- Push Notification Permission ---
const usePushNotifications = () => {
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);
  const notify = (msg) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(msg);
    }
  };
  return notify;
};

// --- Email Notification Hook (placeholder) ---
const useEmailNotification = () => {
  const sendEmail = (type, details) => {
    // Placeholder: call backend API to send email
    // fetch('/api/send-email', {method: 'POST', body: JSON.stringify({type, details})})
  };
  return sendEmail;
};

// --- Profile Modal ---
const ProfileModal = ({ user, onSave, onClose }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <form className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="text-xl font-bold mb-2">Profile</h3>
        <div>
          <label className="text-sm font-semibold">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div>
          <label className="text-sm font-semibold">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div>
          <label className="text-sm font-semibold">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="flex justify-end space-x-4 pt-4">
          <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-slate-200 dark:bg-slate-700">Cancel</button>
          <button type="button" onClick={() => onSave({ name, email, password })} className="px-6 py-2 rounded-lg bg-orange-500 text-white">Save</button>
        </div>
      </form>
    </div>
  );
};

// --- Calendar View ---
const locales = {
  'en-US': require('date-fns/locale/en-US'),
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});
const BookingCalendar = ({ bookings }) => {
  const events = bookings.map(b => ({
    title: b.equipmentName + ' - ' + b.userName,
    start: b.startTime,
    end: new Date(b.startTime.getTime() + (b.slotDuration || 1) * 60 * 60 * 1000),
  }));
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 400 }}
      />
    </div>
  );
};

// --- Waitlist Modal ---
const WaitlistModal = ({ equipment, onJoin, onClose }) => {
  const [email, setEmail] = useState('');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <form className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-8 max-w-md w-full space-y-4">
        <h3 className="text-xl font-bold mb-2">Join Waitlist for {equipment.name}</h3>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" className="w-full p-3 mt-1 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        <div className="flex justify-end space-x-4 pt-4">
          <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-slate-200 dark:bg-slate-700">Cancel</button>
          <button type="button" onClick={() => onJoin(email)} className="px-6 py-2 rounded-lg bg-blue-500 text-white">Join Waitlist</button>
        </div>
      </form>
    </div>
  );
};

// --- Admin Stats & Export Modal ---
const AdminStatsModal = ({ stats, onExport, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-8 max-w-md w-full space-y-4">
      <h3 className="text-xl font-bold mb-2">Booking Statistics</h3>
      <div className="space-y-2">
        <div>Total Bookings: {stats.total}</div>
        <div>Upcoming: {stats.upcoming}</div>
        <div>Past: {stats.past}</div>
      </div>
      <div className="flex justify-end space-x-4 pt-4">
        <button type="button" onClick={onExport} className="px-6 py-2 rounded-lg bg-green-500 text-white">Export CSV</button>
        <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-slate-200 dark:bg-slate-700">Close</button>
      </div>
    </div>
  </div>
);

// --- Main App Component (Acts as a router) ---
const App = () => {
    const [db, setDb] = useState(null);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    const [currentView, setCurrentView] = useState('schedule');
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [allPastBookings, setAllPastBookings] = useState([]);
    const [allSupplyBookings, setAllSupplyBookings] = useState([]);
    const [bookingToCancel, setBookingToCancel] = useState(null);
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileUser, setProfileUser] = useState(null);
    const appId = 'default-lab-booking-app';
    const isAdmin = loggedInUser && loggedInUser.srn === 'PES1UGBTXXX';

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
        // Restrict teams to only one slot per day if slotDuration is 2
        if (user.teamId && slotDuration === 2) {
            if (relevantBookingsForDay.length >= 1) {
                setErrorMessage("Your team can only book one 2-hour slot for this item per day.");
                setIsBookingModalOpen(false);
                return;
            }
        } else if (user.teamId) {
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
    const handleUserUpdate = (updatedUser) => {
        setLoggedInUser(updatedUser);
    };

    // Countdown effect for resend OTP
    useEffect(() => {
        let timer;
        if (resendCountdown > 0) {
            timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading...</div>;
    }
    
    if (authError) {
         return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-orange-500">{authError}</div>;
    }

    if (!loggedInUser) {
        return <LoginPage db={db} setLoggedInUser={setLoggedInUser} />;
    }

    return (
        <>
            <DarkModeToggle />
            <BookingPage db={db} user={loggedInUser} onLogout={() => setLoggedInUser(null)} onUpdateUser={handleUserUpdate} onProfile={() => { setProfileUser(loggedInUser); setShowProfileModal(true); }} />
            {showProfileModal && <ProfileModal user={profileUser} onSave={(data) => { /* handle save logic here */ setShowProfileModal(false); }} onClose={() => setShowProfileModal(false)} />}
        </>
    );
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
    const [otpSentTime, setOtpSentTime] = useState(null);
    const [resendCountdown, setResendCountdown] = useState(0);
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
    
    const handleSendOtp = async (e, isResend = false) => {
        if (e) e.preventDefault();
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
            setOtpSentTime(Date.now());
            setResendCountdown(60);
            if (!isResend) setStep('otp');
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

    // Countdown effect for resend OTP
    useEffect(() => {
        let timer;
        if (resendCountdown > 0) {
            timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    if (step === 'capstone') {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                    <div className="flex justify-center mb-6">
                        <img src={logoPesu} alt="PES University Logo" style={{height: 56, width: 'auto'}} />
                    </div>
                    <h2 className="text-2xl font-bold text-center text-blue-900 mb-2">Welcome!</h2>
                    <p className="text-center text-slate-600 mb-8">Are you booking equipment for a capstone project?</p>
                    <div className="flex justify-around">
                        <button onClick={() => {setIsCapstone(true); setStep('details')}} className="w-full mr-2 p-3 bg-blue-800 text-white font-bold rounded-lg hover:bg-blue-900 transition-all">Yes</button>
                        <button onClick={() => {setIsCapstone(false); setStep('details')}} className="w-full ml-2 p-3 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-all">No</button>
                    </div>
                </div>
                <footer className="w-full text-center py-2 text-xs text-slate-400 mt-8 select-none pointer-events-none">Developed and maintained by Achint Kiran</footer>
            </div>
        );
    }

    if (step === 'otp') {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                    <h2 className="text-2xl font-bold text-center text-blue-900 mb-1">Verify Your Email</h2>
                    <p className="text-center text-slate-500 mb-8">Enter the 6-digit code sent to your email</p>
                    {error && <p className="bg-orange-100 text-orange-700 p-3 rounded-lg mb-4 text-sm">{error}</p>}
                    {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-sm">{message}</p>}
                    <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp();}} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700">OTP Code</label>
                            <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="123456" required/>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:shadow-lg hover:from-orange-600">
                            {isLoading ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : 'Verify & Login'}
                        </button>
                        <button type="button" onClick={() => setStep('details')} className="w-full text-center text-sm text-blue-800 hover:underline mt-2">Go Back</button>
                    </form>
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            disabled={resendCountdown > 0}
                            onClick={(e) => handleSendOtp(e, true)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold ${resendCountdown > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-800 text-white hover:bg-blue-900'}`}
                        >
                            {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                <div className="flex justify-center mb-6">
                    <img src={logoPesu} alt="PES University Logo" style={{height: 56, width: 'auto'}} />
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
                <img src={logoPesu} alt="PES University Logo" style={{height: 56, width: 'auto'}} />
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
        // Restrict teams to only one slot per day if slotDuration is 2
        if (user.teamId && slotDuration === 2) {
            if (relevantBookingsForDay.length >= 1) {
                setErrorMessage("Your team can only book one 2-hour slot for this item per day.");
                setIsBookingModalOpen(false);
                return;
            }
        } else if (user.teamId) {
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
    const handleUserUpdate = (updatedUser) => {
        setLoggedInUser(updatedUser);
    };

    // Countdown effect for resend OTP
    useEffect(() => {
        let timer;
        if (resendCountdown > 0) {
            timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading...</div>;
    }
    
    if (authError) {
         return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-orange-500">{authError}</div>;
    }

    if (!loggedInUser) {
        return <LoginPage db={db} setLoggedInUser={setLoggedInUser} />;
    }

    return (
        <>
            <DarkModeToggle />
            <BookingPage db={db} user={loggedInUser} onLogout={() => setLoggedInUser(null)} onUpdateUser={handleUserUpdate} onProfile={() => { setProfileUser(loggedInUser); setShowProfileModal(true); }} />
            {showProfileModal && <ProfileModal user={profileUser} onSave={(data) => { /* handle save logic here */ setShowProfileModal(false); }} onClose={() => setShowProfileModal(false)} />}
        </>
    );
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
    const [otpSentTime, setOtpSentTime] = useState(null);
    const [resendCountdown, setResendCountdown] = useState(0);
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
    
    const handleSendOtp = async (e, isResend = false) => {
        if (e) e.preventDefault();
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
            setOtpSentTime(Date.now());
            setResendCountdown(60);
            if (!isResend) setStep('otp');
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

    // Countdown effect for resend OTP
    useEffect(() => {
        let timer;
        if (resendCountdown > 0) {
            timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    if (step === 'capstone') {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                    <div className="flex justify-center mb-6">
                        <img src={logoPesu} alt="PES University Logo" style={{height: 56, width: 'auto'}} />
                    </div>
                    <h2 className="text-2xl font-bold text-center text-blue-900 mb-2">Welcome!</h2>
                    <p className="text-center text-slate-600 mb-8">Are you booking equipment for a capstone project?</p>
                    <div className="flex justify-around">
                        <button onClick={() => {setIsCapstone(true); setStep('details')}} className="w-full mr-2 p-3 bg-blue-800 text-white font-bold rounded-lg hover:bg-blue-900 transition-all">Yes</button>
                        <button onClick={() => {setIsCapstone(false); setStep('details')}} className="w-full ml-2 p-3 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-all">No</button>
                    </div>
                </div>
                <footer className="w-full text-center py-2 text-xs text-slate-400 mt-8 select-none pointer-events-none">Developed and maintained by Achint Kiran</footer>
            </div>
        );
    }

    if (step === 'otp') {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                    <h2 className="text-2xl font-bold text-center text-blue-900 mb-1">Verify Your Email</h2>
                    <p className="text-center text-slate-500 mb-8">Enter the 6-digit code sent to your email</p>
                    {error && <p className="bg-orange-100 text-orange-700 p-3 rounded-lg mb-4 text-sm">{error}</p>}
                    {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-sm">{message}</p>}
                    <form onSubmit={(e) => { e.preventDefault(); handleVerifyOtp();}} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-slate-700">OTP Code</label>
                            <input type="number" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full p-3 mt-1 bg-slate-100 rounded-lg" placeholder="123456" required/>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:shadow-lg hover:from-orange-600">
                            {isLoading ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : 'Verify & Login'}
                        </button>
                        <button type="button" onClick={() => setStep('details')} className="w-full text-center text-sm text-blue-800 hover:underline mt-2">Go Back</button>
                    </form>
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            disabled={resendCountdown > 0}
                            onClick={(e) => handleSendOtp(e, true)}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold ${resendCountdown > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-800 text-white hover:bg-blue-900'}`}
                        >
                            {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-slate-200">
                <div className="flex justify-center mb-6">
                    <img src={logoPesu} alt="PES University Logo" style={{height: 56, width: 'auto'}} />
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