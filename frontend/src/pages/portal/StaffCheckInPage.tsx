import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/dashboard/Toast'
import { Button } from '@/components/ui/Button'

interface GpsCheckInState {
  permissionGranted: boolean | null
  location: { latitude: number; longitude: number } | null
  accuracy: number | null
  isCheckingIn: boolean
  showLocationInfo: boolean
  withinRadius: boolean | null
  distance: number | null
  success: boolean | null
  error: string | null
}

const initialState: GpsCheckInState = {
  permissionGranted: null,
  location: null,
  accuracy: null,
  isCheckingIn: false,
  showLocationInfo: false,
  withinRadius: null,
  distance: null,
  success: null,
  error: null,
}

export function StaffCheckInPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { push } = useToast()

  const [state, setState] = useState<GpsCheckInState>(initialState)

  // Check if user is eligible for check-in
  const canCheckIn =
    user?.roles?.includes('HEADTEACHER') ||
    user?.roles?.includes('CLASS_TEACHER') ||
    user?.roles?.includes('SUBJECT_TEACHER') ||
    user?.roles?.includes('ASSISTANT_HEADTEACHER') ||
    user?.roles.some(
      (role) => role === 'NON_TEACHING_STAFF' || role === 'ADMINISTRATIVE_STAFF' || role === 'SUPPORT_STAFF',
    )

  if (!canCheckIn) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-ink-600">
          You do not have permission to check in staff attendance.
        </p>
        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    )
  }

  useEffect(() => {
    if (state.permissionGranted === null) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            ...initialState,
            permissionGranted: true,
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
            showLocationInfo: true,
            isCheckingIn: false,
            withinRadius: null,
            distance: null,
            success: null,
            error: null,
          })
        },
        (error) => {
          setState({
            ...initialState,
            permissionGranted: false,
            error:
              error.code === error.PERMISSION_DENIED
                ? 'Location permission denied. Please enable location services.'
                : error.code === error.POSITION_UNAVAILABLE
                  ? 'Location information is unavailable.'
                  : error.code === error.TIMEOUT
                    ? 'Location request timed out.'
                    : 'An unknown error occurred with location services.'
          })
        },
        {
          enableHighAccuracy: true,
          maximumAge: 60000,
          timeout: 15000,
        },
      )
    }
  }, [state.permissionGranted])

  const handleCheckIn = () => {
    if (!state.location || state.withinRadius === false) {
      return
    }

    fetch('/api/attendance/check-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.email ?? ''}`,
      },
      body: JSON.stringify({
        latitude: state.location!.latitude,
        longitude: state.location!.longitude,
        accuracy: state.accuracy!,
        capturedAt: new Date().toISOString(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setState({
            ...initialState,
            permissionGranted: true,
            location: state.location!,
            accuracy: state.accuracy!,
            showLocationInfo: true,
            withinRadius: data.withinRadius,
            distance: data.distanceMeters,
            success: true,
            error: null,
          })
          push('success', 'Check-in successful!')
          navigate('/', { replace: true })
        } else {
          setState({
            ...initialState,
            permissionGranted: true,
            showLocationInfo: true,
            withinRadius: false,
            distance: data.distanceMeters ?? 0,
            success: false,
            error: data.message ?? 'Check-in failed.',
          })
          if (data.message?.includes('too far')) {
            push('error', 'You are outside the school attendance radius.')
          } else if (data.message?.includes('already')) {
            push('error', 'You have already checked in today.')
          } else {
            push('error', data.message ?? 'Check-in failed.')
          }
        }
      })
      .catch((err) => {
        setState({
          ...initialState,
          permissionGranted: true,
          showLocationInfo: true,
          error: err instanceof Error ? err.message : 'Check-in failed.',
        })
        push('error', 'Could not complete check-in. Please try again.')
      })
  }

  // If we already have location info and haven't checked in yet, show the confirmation
  const shouldShowCheckIn =
    state.permissionGranted === true &&
    state.location &&
    !state.success &&
    state.withinRadius !== false

  return (
    <div className="min-h-screen p-6 bg-cream-100">
      <h1 className="text-2xl font-bold mb-6">Staff Check-In</h1>

      {/* Permission status - location request shown initially */}
      {state.permissionGranted === null && (
        <div className="mb-4 p-4 rounded-xl border border-cream-300 bg-cream-50 text-sm">
          <p>We need your permission to access your location for attendance check-in.</p>
          <p className="mt-2 text-ink-500/80">
            The system will ask for your location when you press Check In below.
          </p>
        </div>
      )}

      {/* Location info */}
      {state.permissionGranted === true && state.location && state.showLocationInfo && (
        <div className="mb-6 p-4 rounded-xl border border-royal-300 bg-royal-50 text-sm">
          <p>Your current location:</p>
          <p className="font-medium">
            {state.location.latitude.toFixed(5)}, {state.location.longitude.toFixed(5)}
          </p>
          <p className="text-ink-500 mt-1">Accuracy: {state.accuracy?.toFixed(0)}m</p>
        </div>
      )}

      {/* Error state */}
      {state.error && (
        <div className="mb-4 p-4 rounded-xl border border-red-300 bg-red-50 text-sm">
          <span>{state.error}</span>
        </div>
      )}

      {/* Already checked in */}
      {state.success === true && (
        <div className="mb-6 p-4 rounded-xl border border-green-300 bg-green-50 text-sm">
          <span>Successfully checked in at {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Outside radius */}
      {state.withinRadius === false && state.distance !== null && !state.success && (
        <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-sm">
          <span>You are {state.distance} outside the school attendance radius. The radius is 100 metres.</span>
        </div>
      )}

      {/* Check-in button - shown when we have location and within radius */}
      {shouldShowCheckIn && !state.success && (
        <div className="mb-8">
          <Button
            disabled={state.isCheckingIn}
            onClick={handleCheckIn}
            className="w-full"
          >
            {state.isCheckingIn ? (
              <span />
            ) : (
              <>
                Check In
              </>
            )}
          </Button>
          <p className="mt-2 text-ink-500 text-xs">
            GPS accuracy must be within {50}m and you must be within 100m of the school.
          </p>
        </div>
      )}

      {/* Instruction text when no location yet */}
      {!state.permissionGranted && !state.isCheckingIn && (
        <p className="mt-4 text-ink-500 text-sm">
          Press the button below to allow location access and check in.
        </p>
      )}
    </div>
  )
}