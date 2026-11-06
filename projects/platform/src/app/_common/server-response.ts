export interface httpResponse{  
    status?: number;   // HTTP status code (e.g., 200, 404, etc.)  
    message: string;  // Message describing the result of the operation  
    data?: any;        // Optional data returned from the server (e.g., user details, etc.)  
    error?: any;     // Optional error object if the operation failed
    success: boolean; // Indicates whether the operation was successful or not
    errorMessage?: string; // Optional error message if the operation failed
}   