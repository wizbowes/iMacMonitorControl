/// Windows DDC/CI backend via Win32 Monitor Configuration API.
///
/// Uses:
///   GetNumberOfPhysicalMonitorsFromHMONITOR  → enumerate
///   GetPhysicalMonitorsFromHMONITOR          → get handles
///   SetVCPFeature                            → write VCP codes
///   DestroyPhysicalMonitors                  → cleanup
///
/// All calls are synchronous. Error codes from GetLastError() are surfaced
/// as BackendError::Platform.
use windows::{
    core::PCWSTR,
    Win32::{
        Devices::Display::{
            DestroyPhysicalMonitors, GetNumberOfPhysicalMonitorsFromHMONITOR,
            GetPhysicalMonitorsFromHMONITOR, SetVCPFeature, PHYSICAL_MONITOR,
        },
        Foundation::{BOOL, LPARAM, RECT},
        Graphics::Gdi::{EnumDisplayMonitors, HDC, HMONITOR},
    },
};

use super::{BackendError, MonitorBackend, MonitorInfo, Result};

pub struct WinBackend;

impl WinBackend {
    pub fn new() -> Self {
        WinBackend
    }

    fn with_monitor<F>(&self, monitor_index: usize, f: F) -> Result<()>
    where
        F: FnOnce(&PHYSICAL_MONITOR) -> Result<()>,
    {
        let hmonitors = enum_hmonitors()?;
        let hmon = hmonitors.get(monitor_index).copied().ok_or(BackendError::NotFound)?;
        let physicals = physical_monitors_for(hmon)?;
        let pm = physicals.first().ok_or(BackendError::NotFound)?;
        let result = f(pm);
        unsafe { DestroyPhysicalMonitors(physicals.as_slice()) };
        result
    }
}

impl MonitorBackend for WinBackend {
    fn set_vcp(&self, monitor_index: usize, code: u8, value: u16) -> Result<()> {
        self.with_monitor(monitor_index, |pm| {
            let ok = unsafe { SetVCPFeature(pm.hPhysicalMonitor, code, value as u32) };
            if ok != 0 {
                Ok(())
            } else {
                Err(BackendError::Ddc(format!(
                    "SetVCPFeature failed for code 0x{code:02X}"
                )))
            }
        })
    }

    fn enumerate(&self) -> Result<Vec<MonitorInfo>> {
        let hmonitors = enum_hmonitors()?;
        Ok(hmonitors
            .iter()
            .enumerate()
            .map(|(i, _)| MonitorInfo {
                name: format!("Display {}", i + 1),
                ip:   None,
            })
            .collect())
    }
}

fn enum_hmonitors() -> Result<Vec<HMONITOR>> {
    let mut monitors: Vec<HMONITOR> = Vec::new();
    let monitors_ptr = &mut monitors as *mut Vec<HMONITOR> as isize;

    unsafe extern "system" fn callback(
        hmon: HMONITOR,
        _hdc: HDC,
        _rect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let list = unsafe { &mut *(lparam.0 as *mut Vec<HMONITOR>) };
        list.push(hmon);
        BOOL(1)
    }

    unsafe {
        EnumDisplayMonitors(
            HDC::default(),
            None,
            Some(callback),
            windows::Win32::Foundation::LPARAM(monitors_ptr),
        )
    };

    Ok(monitors)
}

fn physical_monitors_for(hmon: HMONITOR) -> Result<Vec<PHYSICAL_MONITOR>> {
    let mut count: u32 = 0;
    unsafe { GetNumberOfPhysicalMonitorsFromHMONITOR(hmon, &mut count) }
        .map_err(|e| BackendError::Platform(e.to_string()))?;

    let mut physicals = vec![PHYSICAL_MONITOR::default(); count as usize];
    unsafe { GetPhysicalMonitorsFromHMONITOR(hmon, physicals.as_mut_slice()) }
        .map_err(|e| BackendError::Platform(e.to_string()))?;

    Ok(physicals)
}
