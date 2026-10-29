//! Browser solver boundary. The integer optimization algorithm is not implemented yet.
#[no_mangle]
pub extern "C" fn solver_version() -> u32 { 1 }

#[cfg(test)]
mod tests {
    #[test]
    fn exposes_abi_version() { assert_eq!(super::solver_version(), 1); }
}
