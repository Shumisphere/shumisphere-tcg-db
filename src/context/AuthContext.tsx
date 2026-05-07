import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthUser {
    id: string;
    email: string;
    name: string;
    picture: string;
    role: "ADMIN" | "USER";
    displayName?: string; // For compatibility with existing components
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>({
        id: "dev-user",
        email: "Dwain3991@gmail.com",
        name: "Admin User",
        picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        role: "ADMIN",
        displayName: "Admin User"
    });
    const [loading, setLoading] = useState(false);

    const login = async () => {
        // No-op for now
    };

    const logout = async () => {
        setUser(null);
    };

    const isAdmin = user?.role === "ADMIN";

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
