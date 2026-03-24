export interface Driver {
  id: string;
  name: string;
  // ... other fields
  vehicle_status ?: 'online'; // or whatever values you use
  // or if it's from VehicleStatus enum:
  // vehicle_status?: VehicleStatus;
}