import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Linking,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AuthSession from "expo-auth-session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";

const API_URL = "https://sharda-attendance-backend.onrender.com";
const { width } = Dimensions.get("window");

const App = () => {
  const [systemId, setSystemId] = useState("");
  const [password, setPassword] = useState("");
  const [jwtToken, setJwtToken] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState({
    register: false,
    login: false,
    fetch: false,
    gmailAuth: false,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [columnWidths, setColumnWidths] = useState({});
  const animationRef = React.useRef(null);

  // Check for stored token on app load
  useEffect(() => {
    const loadStoredToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("jwtToken");
        const storedSystemId = await AsyncStorage.getItem("systemId");
        if (storedToken) {
          setJwtToken(storedToken);
          setMessage("Welcome back!");
        }
        if (storedSystemId) {
          setSystemId(storedSystemId);
        }
      } catch (err) {
        console.error("Error loading stored data:", err);
      }
    };

    loadStoredToken();
  }, []);

  // Handle deep linking for Gmail auth callback
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event?.url;
      if (url) {
        const params = new URL(url).searchParams;
        const token = params.get("token");
        if (token) {
          await AsyncStorage.setItem("jwtToken", token);
          setJwtToken(token);
          setMessage("Gmail authentication complete!");
        }
      }
    };

    // Set up deep link listener
    Linking.addEventListener("url", handleDeepLink);

    // Initial URL check (app opened through deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        const params = new URL(url).searchParams;
        const token = params.get("token");
        if (token) {
          AsyncStorage.setItem("jwtToken", token);
          setJwtToken(token);
          setMessage("Gmail authentication complete!");
        }
      }
    });

    return () => {
      // No need to remove event listener in newer React Native versions
    };
  }, []);

  // Calculate column widths when attendance data changes
  useEffect(() => {
    if (attendance && attendance.length > 0) {
      const headers = Object.keys(attendance[0]);
      setTableHeaders(headers);

      // Calculate optimal column widths based on content
      const widths = {};

      headers.forEach((header) => {
        // Start with header length (plus padding)
        let maxWidth = header.length * 10 + 24;

        // Check all values in this column
        attendance.forEach((row) => {
          const cellValue = String(row[header]);
          const cellWidth = cellValue.length * 8 + 24;
          maxWidth = Math.max(maxWidth, cellWidth);
        });

        // Set minimum and maximum constraints
        widths[header] = Math.min(Math.max(maxWidth, 100), 200);
      });

      setColumnWidths(widths);
    }
  }, [attendance]);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const handleRegister = async () => {
    clearMessages();
    if (!systemId.trim() || !password.trim()) {
      setError("Please provide both system ID and password.");
      return;
    }

    setLoading((prev) => ({ ...prev, register: true }));
    try {
      const response = await axios.post(`${API_URL}/register`, {
        systemId,
        password,
      });

      setMessage(response.data.message || "Registration successful!");
      await AsyncStorage.setItem("systemId", systemId);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          err.response?.data ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading((prev) => ({ ...prev, register: false }));
    }
  };

  const handleLogin = async () => {
    clearMessages();
    if (!systemId.trim() || !password.trim()) {
      setError("Please provide both system ID and password.");
      return;
    }

    setLoading((prev) => ({ ...prev, login: true }));
    try {
      const response = await axios.post(`${API_URL}/login`, {
        systemId,
        password,
      });

      const token = response.data.token;
      setJwtToken(token);
      await AsyncStorage.setItem("jwtToken", token);
      await AsyncStorage.setItem("systemId", systemId);
      setMessage("Login successful!");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          err.response?.data ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading((prev) => ({ ...prev, login: false }));
    }
  };

  const handleGmailAuth = async () => {
    clearMessages();
    if (!systemId.trim()) {
      setError("Please enter your system ID before Gmail authentication.");
      return;
    }

    setLoading((prev) => ({ ...prev, gmailAuth: true }));
    try {
      await AsyncStorage.setItem("systemId", systemId);

      // In a real implementation, you would use a proper OAuth flow with expo-auth-session
      // This is a simplified version to demonstrate the UI
      const redirectUrl = `${API_URL}/auth/gmail?systemId=${encodeURIComponent(
        systemId
      )}`;

      // Open the URL in the device browser
      const result = await Linking.openURL(redirectUrl);

      setMessage(
        "Gmail authentication initiated. Please complete the process in your browser."
      );
    } catch (err) {
      console.error(err);
      setError("Failed to initiate Gmail authentication. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, gmailAuth: false }));
    }
  };

  const fetchAttendance = async () => {
    clearMessages();
    if (!jwtToken) {
      setError("Please login (or authenticate with Gmail) first.");
      return;
    }

    setLoading((prev) => ({ ...prev, fetch: true }));
    setAttendance(null);

    if (animationRef.current) {
      animationRef.current.play();
    }

    try {
      const response = await axios.post(
        `${API_URL}/attendance`,
        {},
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );

      setAttendance(response.data.attendance || []);
      if (response.data.attendance?.length > 0) {
        setMessage("Attendance fetched successfully!");
      } else {
        setMessage("No attendance records found.");
      }
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        setError("Your session has expired. Please login again.");
        setJwtToken("");
        await AsyncStorage.removeItem("jwtToken");
      } else {
        setError(
          err.response?.data?.message ||
            err.response?.data ||
            "Error fetching attendance. Please try again."
        );
      }
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem("jwtToken");
      setJwtToken("");
      setAttendance(null);
      setMessage("Logged out successfully.");
    } catch (err) {
      console.error(err);
      setError("Error logging out.");
    }
  };

  // Render a table cell with formatted value
  const renderCell = (value, header, index, isHeader = false) => {
    const width = columnWidths[header] || 120;

    return (
      <View
        key={`${header}-${index}`}
        style={[styles.tableCell, { width }, isHeader && styles.headerCell]}
      >
        <Text
          style={[styles.tableCellText, isHeader && styles.headerCellText]}
          numberOfLines={1}
        >
          {isHeader
            ? header.charAt(0).toUpperCase() +
              header.slice(1).replace(/([A-Z])/g, " $1")
            : value}
        </Text>
      </View>
    );
  };

  // Create table row components for direct use in ScrollView
  const createTableRows = () => {
    if (!attendance || attendance.length === 0) return null;

    const rows = [];

    // Add header
    rows.push(
      <View key='header' style={styles.tableHeader}>
        {tableHeaders.map((header, index) =>
          renderCell(header, header, index, true)
        )}
      </View>
    );

    // Add data rows
    attendance.forEach((item, index) => {
      rows.push(
        <View
          key={`row-${index}`}
          style={[
            styles.tableRow,
            index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
          ]}
        >
          {tableHeaders.map((header, cellIndex) =>
            renderCell(item[header], header, cellIndex)
          )}
        </View>
      );
    });

    return rows;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='light-content' backgroundColor='#1e3a8a' />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          style={styles.gradientBackground}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps='handled'
          >
            <View style={styles.headerContainer}>
              <Text style={styles.headerTitle}>Attendance Tracker</Text>
              <Text style={styles.headerSubtitle}>
                {jwtToken
                  ? "Track your attendance records"
                  : "Sign in to access your attendance"}
              </Text>
            </View>

            {!jwtToken ? (
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>System ID</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name='person-outline'
                      size={20}
                      color='#64748b'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={systemId}
                      onChangeText={setSystemId}
                      placeholder='Enter your system ID'
                      placeholderTextColor='#94a3b8'
                      autoCapitalize='none'
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name='lock-closed-outline'
                      size={20}
                      color='#64748b'
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder='Enter your password'
                      placeholderTextColor='#94a3b8'
                      secureTextEntry={secureTextEntry}
                    />
                    <TouchableOpacity
                      onPress={() => setSecureTextEntry(!secureTextEntry)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={
                          secureTextEntry ? "eye-outline" : "eye-off-outline"
                        }
                        size={20}
                        color='#64748b'
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.loginButton]}
                    onPress={handleLogin}
                    disabled={loading.login}
                  >
                    {loading.login ? (
                      <ActivityIndicator color='#ffffff' />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Ionicons
                          name='log-in-outline'
                          size={20}
                          color='#ffffff'
                        />
                        <Text style={styles.buttonText}>Login</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.registerButton]}
                    onPress={handleRegister}
                    disabled={loading.register}
                  >
                    {loading.register ? (
                      <ActivityIndicator color='#ffffff' />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Ionicons
                          name='person-add-outline'
                          size={20}
                          color='#ffffff'
                        />
                        <Text style={styles.buttonText}>Register</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, styles.gmailButton]}
                  onPress={handleGmailAuth}
                  disabled={loading.gmailAuth}
                >
                  {loading.gmailAuth ? (
                    <ActivityIndicator color='#ffffff' />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name='mail-outline' size={20} color='#ffffff' />
                      <Text style={styles.buttonText}>
                        Authenticate with Gmail
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.loggedInContainer}>
                <View style={styles.welcomeSection}>
                  <Text style={styles.welcomeText}>Welcome, {systemId}</Text>
                  <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                  >
                    <Text style={styles.logoutText}>Logout</Text>
                    <Ionicons
                      name='log-out-outline'
                      size={16}
                      color='#ef4444'
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, styles.fetchButton]}
                  onPress={fetchAttendance}
                  disabled={loading.fetch}
                >
                  {loading.fetch ? (
                    <ActivityIndicator color='#ffffff' />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons
                        name='calendar-outline'
                        size={20}
                        color='#ffffff'
                      />
                      <Text style={styles.buttonText}>Fetch Attendance</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {(message || error) && (
              <View style={styles.messageContainer}>
                {message ? (
                  <View style={styles.successMessage}>
                    <Ionicons
                      name='checkmark-circle-outline'
                      size={20}
                      color='#10b981'
                    />
                    <Text style={styles.successText}>{message}</Text>
                  </View>
                ) : null}

                {error ? (
                  <View style={styles.errorMessage}>
                    <Ionicons
                      name='alert-circle-outline'
                      size={20}
                      color='#ef4444'
                    />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {loading.fetch && (
              <View style={styles.loadingContainer}>
                <LottieView
                  ref={animationRef}
                  source={require("./assets/loading.json")}
                  autoPlay
                  loop
                  style={styles.loadingAnimation}
                />
                <Text style={styles.loadingText}>
                  Fetching attendance data...
                </Text>
              </View>
            )}

            {attendance && (
              <View style={styles.attendanceContainer}>
                <View style={styles.attendanceHeader}>
                  <Text style={styles.attendanceTitle}>Attendance Details</Text>
                  <Text style={styles.attendanceSubtitle}>
                    {attendance.length}{" "}
                    {attendance.length === 1 ? "record" : "records"} found
                  </Text>
                </View>

                {attendance.length === 0 ? (
                  <View style={styles.emptyAttendance}>
                    <Ionicons name='calendar' size={48} color='#94a3b8' />
                    <Text style={styles.emptyAttendanceText}>
                      No attendance records found
                    </Text>
                  </View>
                ) : (
                  <View style={styles.tableContainer}>
                    {/* Using ScrollView horizontally for wide tables */}
                    <ScrollView
                      horizontal={true}
                      showsHorizontalScrollIndicator={true}
                    >
                      <View>
                        {/* Directly render table rows without a nested FlatList */}
                        {createTableRows()}
                      </View>
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1e3a8a",
  },
  keyboardAvoid: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#e2e8f0",
    marginTop: 8,
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#334155",
    paddingRight: 12,
  },
  eyeIcon: {
    padding: 12,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  button: {
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  loginButton: {
    backgroundColor: "#3b82f6",
    flex: 1,
    marginRight: 8,
  },
  registerButton: {
    backgroundColor: "#0f766e",
    flex: 1,
    marginLeft: 8,
  },
  gmailButton: {
    backgroundColor: "#ef4444",
    marginTop: 10,
    width: "100%",
  },
  fetchButton: {
    backgroundColor: "#3b82f6",
    marginTop: 20,
    width: "100%",
  },
  messageContainer: {
    marginTop: 20,
  },
  successMessage: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  successText: {
    color: "#10b981",
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  errorMessage: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    color: "#ef4444",
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  loggedInContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoutText: {
    fontSize: 14,
    color: "#ef4444",
    marginRight: 4,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingAnimation: {
    width: 150,
    height: 150,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center",
  },
  attendanceContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 12,
  },
  attendanceTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
  },
  attendanceSubtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  emptyAttendance: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyAttendanceText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e40af",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a8a",
  },
  headerCell: {
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerCellText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 0,
  },
  tableRowEven: {
    backgroundColor: "#f8fafc",
  },
  tableRowOdd: {
    backgroundColor: "#ffffff",
  },
  tableCell: {
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    overflow: "hidden",
  },
  tableCellText: {
    fontSize: 14,
    color: "#334155",
  },
});

export default App;